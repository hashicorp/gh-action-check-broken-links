# hashicorp/gh-action-check-broken-links

A GitHub Action that reports all broken links found within a set of provided `.mdx` files

## Example

```yaml
- name: Check for broken links
  uses: hashicorp/gh-action-check-broken-links@v1
  with:
    baseUrl: 'https://hashicorp.com'
    files: 'pages/foo.mdx pages/bar.mdx'
    whitelist: |
      https://google.com/whitelist
      https://yahoo.com/whitelist
```
