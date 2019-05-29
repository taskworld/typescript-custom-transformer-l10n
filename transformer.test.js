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

test('__("test")', '__({ $key: "test", en: "Test", nyan: "Meow" });')
test('__.zzz("test")', '__.zzz("test");')
test(
  '__.string("test")',
  '__.string({ $key: "test", en: "Test", nyan: "Meow" });'
)
test(
  '__.template("test")',
  '__.template({ $key: "test", en: "Test", nyan: "Meow" });'
)
test(
  '__.dual(1, "test", "hello")',
  '__.dual(1, { $key: "test", en: "Test", nyan: "Meow" }, { $key: "hello", en: "Hello", nyan: "Nyan" });'
)
test(
  '__.dual.string(1, "test", "hello")',
  '__.dual.string(1, { $key: "test", en: "Test", nyan: "Meow" }, { $key: "hello", en: "Hello", nyan: "Nyan" });'
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
