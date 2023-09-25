/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import path from 'path'

import * as utils from '../src/utils'

import pkg from '../package.json'

describe(`${pkg.name} -- Utilities`, () => {
  describe('findAllLinks()', () => {
    it('should return an array of objects with all link information given a file', () => {
      const consulFile = path.join(
        __dirname,
        'fixtures/mdx/pages',
        'consul.mdx'
      )
      const terraformFile = path.join(
        __dirname,
        'fixtures/mdx/pages',
        'terraform/getting-started.mdx'
      )

      expect(utils.findAllLinks(consulFile)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://github.com',
            position: expect.objectContaining({
              start: expect.any(Object),
              end: expect.any(Object)
            })
          }),
          expect.objectContaining({
            url: 'https://hashicorp.com',
            position: expect.objectContaining({
              start: expect.any(Object),
              end: expect.any(Object)
            })
          })
        ])
      )

      expect(utils.findAllLinks(terraformFile)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: '/start',
            position: expect.objectContaining({
              start: expect.any(Object),
              end: expect.any(Object)
            })
          }),
          expect.objectContaining({
            url: '#terraform-success',
            position: expect.objectContaining({
              start: expect.any(Object),
              end: expect.any(Object)
            })
          })
        ])
      )
    })
  })

  describe('isAnchorLinkPresent()', () => {
    it('should return true when the anchor link is present on "name" property of an anchor tag', async () => {
      const anchor = 'internal-link'
      const hash = `#${anchor}`
      const markup = `<!doctype html>
<body>
      <a name="${anchor}"></a>
      <h1>Hello World!</h1>
</body>`
      const actual = utils.isAnchorLinkPresent(hash, markup)
      expect(actual).toBe(true)
    })

    it('should return true when the anchor link is present on any element\'s "id" property', async () => {
      const anchor = 'my-cool-internal-link'
      const hash = `#${anchor}`
      const markup = `<!doctype html>
<body>
      <h1>Hello World!</h1>
      <ul id="${anchor}">
        <li>Steve
        <li>Brule
      </u>
</body>`
      const actual = utils.isAnchorLinkPresent(hash, markup)
      expect(actual).toBe(true)
    })

    it('should return false when the anchor is not present anywhere in markup', async () => {
      const anchor = 'my-cool-internal-link'
      const hash = `#${anchor}`
      const markup = `<!doctype html>
<body>
      <h1>Hello World!</h1>
      <ul>
        <li>Steve
        <li>Brule
      </u>
</body>`
      const actual = utils.isAnchorLinkPresent(hash, markup)
      expect(actual).toBe(false)
    })

    it('should return true when the hash is present as href of anchor tag', async () => {
      const anchor = 'my-cool-internal-link'
      const hash = `#${anchor}`
      const markup = `<!doctype html>
<body>
      <h1>Hello World!</h1>
      <ul>
        <li><a href="${hash}">Steve</a>
        <li>Brule
      </u>
</body>`
      const actual = utils.isAnchorLinkPresent(hash, markup)
      expect(actual).toBe(true)
    })
  })
})
