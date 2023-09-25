/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import fs from 'fs'
import html from 'rehype-parse'
import markdown from 'remark-parse'
import unified from 'unified'
import visit from 'unist-util-visit'
import find from 'unist-util-find'
import { Link as MdastLink } from 'mdast'

import { Position } from 'unist'
import { Node, Properties } from 'hast-format'

export interface Link {
  url: string
  position: Position
}

export function isAnchorLinkPresent(hash: string, markup: string): boolean {
  // Remove '#' from hash to create anchor link
  const anchor: string = hash.slice(1)

  const ast = unified()
    .use(html)
    .parse(markup)

  const match: Node | undefined = find(ast, (node: Node) => {
    return (
      // <a name={anchor}></a>
      (node.tagName === 'a' &&
        (node.properties as Properties)?.name === anchor) ||
      // <a href={hash}></a>
      (node.tagName === 'a' &&
        (node.properties as Properties)?.href === hash) ||
      // <{el} id={anchor}></{el}>
      (node.type === 'element' &&
        (node.properties as Properties)?.id === anchor)
    )
  })

  return Boolean(match)
}

export function findAllLinks(filepath: string): Link[] {
  const links: Link[] = []

  const ast = unified()
    .use(markdown)
    .parse(fs.readFileSync(filepath))

  visit(ast, 'link', (link: MdastLink) => {
    links.push({
      url: link.url,
      ...(link.position
        ? { position: link.position }
        : {
            position: {
              start: { line: 1, column: 1 },
              end: { line: 1, column: 1 }
            }
          })
    })
    return
  })

  return links
}
