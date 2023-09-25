/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import * as core from '@actions/core'
import url from 'url'
import fetch from 'node-fetch'
import path from 'path'
import { Position } from 'unist'
import { Endpoints } from '@octokit/types'
import { findAllLinks, isAnchorLinkPresent, Link } from './utils'

type CheckResult = Endpoints['POST /repos/:owner/:repo/check-runs']['parameters']
type Annotations = NonNullable<
  NonNullable<CheckResult['output']>['annotations']
>

interface LinkInfo {
  filename: string
  links: Link[]
}

interface BrokenLink {
  filename: string
  href: {
    relativeHref: string
    qualifiedHref: string
  }
  res: number
  position: Position
}

export function getLinkInfoFromFiles(
  workspace: string,
  files: string[]
): LinkInfo[] {
  return files
    .filter(filename => {
      return (
        filename.split('/').includes('pages') ||
        filename.split('/').includes('content')
      )
    })
    .map(filename => {
      const filepath = path.join(workspace, filename)
      const links = findAllLinks(filepath)

      return {
        filename,
        links
      }
    })
}

export async function collectBrokenLinks(
  baseUrl: string,
  linkInfo: LinkInfo[],
  whitelist: string[]
): Promise<BrokenLink[]> {
  const errors: BrokenLink[] = []

  for (const { filename, links } of linkInfo) {
    for (const link of links) {
      // We extract the path segment `pages` as
      // we are assuming the project is a Next.js project, where filenames
      // under the `/pages` directory serve as their respective urls
      // eg: /pages/some-file.mdx is served at site.com/some-file
      //
      // Additionally, we are handling files located in the `/content`
      // directory similarly in the learn project
      const urlPath = filename
        .split('/')
        .filter(segment => segment !== 'pages' && segment !== 'content')
        .join('/')

      const qualifiedHref = resolveUrl(baseUrl, urlPath, link.url)

      const res = whitelist.includes(qualifiedHref)
        ? 202
        : await fetchStatusCode(qualifiedHref)

      if (res >= 400) {
        errors.push({
          filename,
          href: { relativeHref: link.url, qualifiedHref },
          res,
          position: link.position
        })
      }
    }
  }
  return errors
}

export function resolveUrl(
  baseUrl: string,
  urlPath: string,
  href: string
): string {
  const parsedHref = url.parse(href, false, true)
  // If url is already fully qualified (i.e. has protocol and/or host) we can return the url
  if (parsedHref.host) return href

  // Remove file extension from urlPath
  const filePath = urlPath.replace(/\.mdx$/, '')

  const isAbsolute = href.startsWith('/')
  const isAnchor = href.startsWith('#')

  // Urls with a leading slash (/link), a.k.a absolute-path references, are applied to the site root
  // whereas an anchor link (#link) or a relative-path reference (link) are applied to the current directory
  const qualifiedUrl = isAbsolute
    ? href
    : `${filePath}${isAnchor ? '' : '/'}${href}`

  return (
    url
      .resolve(baseUrl, qualifiedUrl)
      // Special case: Homepage with anchor link
      // Remove the forward slash (/) that precedes a hash mark (#)
      // i.e. xyz.com/#anchor => xyz.com#anchor
      .replace(/\/#/, '#')
      // Remove trailing slash for consistency
      .replace(/\/$/, '')
  )
}

export async function fetchStatusCode(
  href: string,
  retries = 5,
  retryDelay = 500
): Promise<number> {
  core.debug(`Fetching network status for url: "${href}"...`)
  try {
    const res = await fetch(href, { timeout: 1500 })
    const statusCode = await res.status

    // Immediately return status code on non-successful network response
    if (statusCode >= 400) return statusCode

    // Handle case where hash segment is present
    const hash = new URL(href).hash

    // The shebang (`#!`) url fragment is a deprecated AJAX crawling convention once used by Google
    // ref: https://developers.google.com/search/docs/ajax-crawling/
    // As a result, we don't want to treat it like an anchor link
    if (hash && !hash.startsWith('#!')) {
      return isAnchorLinkPresent(hash, await res.text()) ? statusCode : 502
    }

    return statusCode
  } catch (err) {
    if (retries <= 1) return 503

    // Wait for <retryDelay>ms before attempting another fetch
    await new Promise(res => setTimeout(() => res(), retryDelay))
    return await fetchStatusCode(href, retries - 1)
  }
}

export function createAnnotations(brokenLinks: BrokenLink[]): Annotations {
  return brokenLinks.map(x => {
    /* eslint-disable @typescript-eslint/camelcase */
    return {
      path: x.filename,
      start_line: x.position.start.line,
      end_line: x.position.end.line,
      ...(x.position.start.line === x.position.end.line && {
        start_column: x.position.start.column,
        end_column: x.position.end.column
      }),
      annotation_level: 'failure',
      message: `${x.href.qualifiedHref} :: ${errorMessage(x.res)}`
    }
    /* eslint-enable @typescript-eslint/camelcase */
  })
}

function errorMessage(statusCode: number): string {
  switch (statusCode) {
    case 503:
      return 'Failed after multiple attempts'
    case 502:
      return 'Anchor not present  '
    default:
      return `Error code ${statusCode}`
  }
}
