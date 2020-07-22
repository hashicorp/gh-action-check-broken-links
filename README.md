# HashiCorp's Link Checker

![C/I Status](https://github.com/hashicorp/gh-action-check-broken-links/workflows/C/I/badge.svg)

A GitHub Action that reports all broken links found within a set of provided `.mdx` files

- :warning: Currently only supports `.mdx` files
- :warning: Assumes a Next.js project structure (i.e. links resolve from the `/pages` directory)

## Features

Parses `.mdx` files, locating all links. Reports back any failed requests including those that contain a fragment identifier (i.e. https://example.com/page#identifier) but whose resulting markup does not.

## Example Usage

```yaml
- name: HashiCorp's Link Checker
  uses: hashicorp/gh-action-check-broken-links@v1
  with:
    baseUrl: 'https://hashicorp.com'
    files: 'pages/foo.mdx pages/bar.mdx'
    whitelist: |
      https://google.com/whitelist
      https://yahoo.com/whitelist
```
