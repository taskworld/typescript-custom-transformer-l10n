# @taskworld/typescript-custom-transformer-l10n

A TypeScript Custom AST transformer that inlines localization strings into the source code.

## Background

Our localization file is several megabytes large now.
It doesn’t play well with webpack’s code splitting.
This custom AST transformer inlines the calls to localization routines with the data from localization file.

## Usage

Given a source code:

```js
function Tutorial() {
  return (
    <section>
      <h1>{__('tutorial.welcome.headline')}</h1>
      <p>{__('tutorial.welcome.paragraph')}</p>
    </section>
  )
}
```

…and a localization file:

```json
{
  "en": {
    "tutorial.welcome.headline": "Welcome to %{workspace_name}",
    "tutorial.welcome.paragraph": "Your team will have all that you need to get work done."
  },
  "th": {
    "tutorial.welcome.headline": "ยินดีต้อนรับเข้าสู่ %{workspace_name}",
    "tutorial.welcome.paragraph": "บริหารจัดการงานได้อย่างครบถ้วนและมีประสิทธิภาพ"
  }
}
```

…when transpiled with this custom AST transformer, the output will look like this:

```js
function Tutorial() {
  return (
    <section>
      <h1>
        {__({
          $key: 'tutorial.welcome.headline',
          en: 'Welcome to %{workspace_name}',
          th: 'ยินดีต้อนรับเข้าสู่ %{workspace_name}',
        })}
      </h1>
      <p>
        {__({
          $key: 'tutorial.welcome.paragraph',
          en: 'Your team will have all that you need to get work done.',
          th: 'บริหารจัดการงานได้อย่างครบถ้วนและมีประสิทธิภาพ',
        })}
      </p>
    </section>
  )
}
```

See the article [How to Write a TypeScript Transform (Plugin)](https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943) for how to use it in, e.g., webpack.
