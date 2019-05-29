const ts = require('typescript')
const transformer = require('./transformer')

const demoData = {
  en: {
    test: 'Test',
    hello: 'Hello',
  },
  nyan: {
    test: 'Meow',
    hello: 'Nyan',
  },
}

function test(input, output) {
  it(input, () => {
    expect(
      ts
        .transpileModule(input, {
          transformers: {
            before: [transformer({ l10nData: demoData })],
          },
        })
        .outputText.trim()
    ).toBe(output)
  })
}

test('__("test")', '__(__.$("test", { en: "Test", nyan: "Meow" }));')
test('__.zzz("test")', '__.zzz("test");')
test(
  '__.string("test")',
  '__.string(__.$("test", { en: "Test", nyan: "Meow" }));'
)
test(
  '__.template("test")',
  '__.template(__.$("test", { en: "Test", nyan: "Meow" }));'
)
test(
  '__.dual(1, "test", "hello")',
  '__.dual(1, __.$("test", { en: "Test", nyan: "Meow" }), __.$("hello", { en: "Hello", nyan: "Nyan" }));'
)
test(
  '__.dual.string(1, "test", "hello")',
  '__.dual.string(1, __.$("test", { en: "Test", nyan: "Meow" }), __.$("hello", { en: "Hello", nyan: "Nyan" }));'
)
test(
  '__("test", { x: __("hello") })',
  '__(__.$("test", { en: "Test", nyan: "Meow" }), { x: __(__.$("hello", { en: "Hello", nyan: "Nyan" })) });'
)

it('runs the example in README', async () => {
  const readme = require('fs').readFileSync('README.md', 'utf8')
  const prettier = require('prettier')
  let inputCode
  let expectedCode
  readme.replace(/```js\s*(function Tutorial[^]*?)```/g, (a, code) => {
    if (!inputCode) inputCode = code.trim()
    else if (!expectedCode) expectedCode = code.trim()
  })
  const l10nData = JSON.parse(readme.match(/```json\s*(\{[^]*?)```/)[1])
  const prettierConfig = await prettier.resolveConfig('transformer.js')
  const outputCode = prettier
    .format(
      ts.transpileModule(inputCode, {
        transformers: {
          before: [transformer({ l10nData })],
        },
        compilerOptions: {
          charset: 'utf8',
          jsx: 'preserve',
        },
      }).outputText,
      { ...prettierConfig, parser: 'typescript' }
    )
    .trim()
  expect(outputCode).toBe(expectedCode)
})
