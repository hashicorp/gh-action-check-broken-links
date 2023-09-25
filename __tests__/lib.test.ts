/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

jest.mock('node-fetch')
import fetch from 'node-fetch'

import path from 'path'
import { Position } from 'unist'

import * as lib from '../src/lib'
import * as utils from '../src/utils'

import pkg from '../package.json'

const { Response } = jest.requireActual('node-fetch')

describe(`${pkg.name} -- Library`, () => {
  afterAll(() => jest.restoreAllMocks())

  describe('getLinkInfoFromFiles()', () => {
    it('should construct an array of objects that each contain both a filename and an array of its associated links', () => {
      const workspace = path.join(__dirname, 'fixtures/mdx')
      const files = ['pages/consul.mdx', 'pages/terraform/getting-started.mdx']

      const actual = lib.getLinkInfoFromFiles(workspace, files)
      expect(actual).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'pages/consul.mdx',
            links: expect.any(Array)
          }),
          expect.objectContaining({
            filename: 'pages/terraform/getting-started.mdx',
            links: expect.any(Array)
          })
        ])
      )
    })

    it("should reject files outside the 'pages' or 'content' directories", () => {
      const workspace = path.join(__dirname, 'fixtures/mixed')
      const files = [
        'invalid/terraform/foo.mdx',
        'content/tutorials/vault/getting-started.mdx',
        'pages/terraform/install.mdx'
      ]

      const actual = lib.getLinkInfoFromFiles(workspace, files)

      expect(actual.length).toEqual(2)

      expect(actual).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'content/tutorials/vault/getting-started.mdx'
          }),
          expect.objectContaining({
            filename: 'pages/terraform/install.mdx'
          })
        ])
      )
    })
  })

  describe('collectBrokenLinks()', () => {
    const mockedFetch = (fetch as unknown) as jest.Mock<Promise<Response>>

    beforeEach(() => {
      jest.resetAllMocks()
    })

    it('should return an array of objects whose network request failed', async () => {
      const failedStatusCode = 555
      mockedFetch
        .mockReturnValueOnce(
          Promise.resolve(new Response(undefined, { status: failedStatusCode }))
        )
        .mockReturnValue(
          Promise.resolve(new Response(undefined, { status: 200 }))
        )

      const baseUrl = 'https://hashicorp.com'
      const linkInfo = [
        {
          filename: 'pages/consul/getting-started/install.mdx',
          links: [
            { url: '/foo', position: ({} as unknown) as Position },
            { url: '/bar', position: ({} as unknown) as Position },
            { url: '/baz', position: ({} as unknown) as Position }
          ]
        }
      ]

      const actual = await lib.collectBrokenLinks(baseUrl, linkInfo, [])

      expect(actual).toHaveLength(1)

      expect(actual).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'pages/consul/getting-started/install.mdx',
            href: expect.objectContaining({
              relativeHref: '/foo',
              qualifiedHref: 'https://hashicorp.com/foo'
            }),
            res: failedStatusCode,
            position: expect.any(Object)
          })
        ])
      )
    })

    it('should not report any urls that are in the provided whitelist', async () => {
      const failedStatusCode = 555
      mockedFetch.mockReturnValue(
        Promise.resolve(new Response(undefined, { status: failedStatusCode }))
      )

      const baseUrl = 'https://hashicorp.com'

      const linkInfo = [
        {
          filename: 'pages/consul/getting-started/install.mdx',
          links: [
            { url: '/foo', position: ({} as unknown) as Position },
            { url: '/bar', position: ({} as unknown) as Position },
            { url: '/baz', position: ({} as unknown) as Position }
          ]
        }
      ]

      const whitelist = [
        'https://hashicorp.com/foo',
        'https://hashicorp.com/baz'
      ]

      const actual = await lib.collectBrokenLinks(baseUrl, linkInfo, whitelist)

      expect(actual).toHaveLength(1)

      expect(actual).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'pages/consul/getting-started/install.mdx',
            href: expect.objectContaining({
              relativeHref: '/bar',
              qualifiedHref: 'https://hashicorp.com/bar'
            }),
            res: failedStatusCode,
            position: expect.any(Object)
          })
        ])
      )
    })

    it('should return an empty array if all urls returned successful network requests', async () => {
      mockedFetch.mockReturnValue(
        Promise.resolve(new Response(undefined, { status: 200 }))
      )

      const baseUrl = 'https://hashicorp.com'

      const linkInfo = [
        {
          filename: 'pages/consul/getting-started/install.mdx',
          links: [
            { url: '/foo', position: ({} as unknown) as Position },
            { url: '/bar', position: ({} as unknown) as Position },
            { url: '/baz', position: ({} as unknown) as Position }
          ]
        }
      ]

      const actual = await lib.collectBrokenLinks(baseUrl, linkInfo, [])

      expect(actual).toStrictEqual([])
    })
  })

  describe('resolveUrl()', () => {
    it('should handle an anchor', () => {
      const baseUrl = 'https://hashicorp.com'
      const filename = 'consul/getting-started/install.mdx'
      const href = '#anchor-link'

      const actual = lib.resolveUrl(baseUrl, filename, href)
      const expected =
        'https://hashicorp.com/consul/getting-started/install#anchor-link'

      expect(actual).toBe(expected)
    })

    it('should handle deep relative link', () => {
      const baseUrl = 'https://hashicorp.com'
      const filename = 'consul/getting-started/install.mdx'
      const href = '/foo'

      const actual = lib.resolveUrl(baseUrl, filename, href)
      const expected = 'https://hashicorp.com/foo'

      expect(actual).toBe(expected)
    })
  })

  describe('fetchStatusCode()', () => {
    const mockedFetch = (fetch as unknown) as jest.Mock<Promise<Response>>
    beforeEach(() => jest.restoreAllMocks())

    it('should perform a network request given a url', async () => {
      const href = 'https://google.com'

      mockedFetch.mockReturnValue(Promise.resolve(new Response()))

      await lib.fetchStatusCode(href)

      expect(mockedFetch).toHaveBeenCalledTimes(1)
    })

    it('should return the status code of the network request', async () => {
      const href = 'https://google.com'
      const statusCode = 301

      mockedFetch.mockReturnValueOnce(
        Promise.resolve(new Response(undefined, { status: statusCode }))
      )

      const actual = await lib.fetchStatusCode(href)

      expect(actual).toEqual(statusCode)
    })

    it('should perform a number of retries and finally return a status code of 503 if network cannot resolve', async () => {
      mockedFetch.mockReturnValue(Promise.reject())

      const actual = await lib.fetchStatusCode('https://google.commmm')

      expect(mockedFetch).toBeCalledTimes(5)

      expect(actual).toEqual(503)
    })

    describe('> with anchor links', () => {
      it('should return a status code of 502 when an anchor link is not present in the resulting markup', async () => {
        const anchor = 'inline-link-test'
        const hash = `#${anchor}`
        const markup = '<html><h1>No anchor links here!</h1></html>'

        const isAnchorLinkPresentSpy = jest
          .spyOn(utils, 'isAnchorLinkPresent')
          .mockImplementation(() => false)

        mockedFetch.mockReturnValue(
          Promise.resolve(
            new Response(markup, {
              status: 200
            })
          )
        )

        const actual = await lib.fetchStatusCode(`https://hashicorp.com${hash}`)

        expect(isAnchorLinkPresentSpy).toBeCalledWith(hash, markup)

        expect(actual).toEqual(502)
      })

      it('should return the status code of the initial request when the anchor link is present in the resulting markup', async () => {
        const anchor = 'inline-link'
        const hash = `#${anchor}`
        const markup = `<html><h1 id="${anchor}">Inline link present!</h1></html>`
        const status = 301

        mockedFetch.mockReturnValue(
          Promise.resolve(
            new Response(markup, {
              status
            })
          )
        )

        const isAnchorLinkPresentSpy = jest
          .spyOn(utils, 'isAnchorLinkPresent')
          .mockImplementation(() => true)

        const actual = await lib.fetchStatusCode(`https://hashicorp.com${hash}`)

        expect(isAnchorLinkPresentSpy).toBeCalledWith(hash, markup)

        expect(actual).toEqual(status)
      })

      it('should not treat shebang url fragments as anchor links', async () => {
        mockedFetch.mockReturnValue(
          Promise.resolve(new Response(undefined, { status: 200 }))
        )

        const isAnchorLinkPresentSpy = jest.spyOn(utils, 'isAnchorLinkPresent')

        await lib.fetchStatusCode(
          'https://groups.google.com/forum/#!forum/vault-tool'
        )

        expect(isAnchorLinkPresentSpy).not.toHaveBeenCalled()
      })
    })
  })
})
