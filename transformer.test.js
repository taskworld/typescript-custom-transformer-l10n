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
  'a+1': {
    x: 1,
  },
  'a-1': {
    x: 2,
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
    ).toBe(ts.transpileModule(output, {}).outputText.trim())
  })
}

test(
  '__("test")',
  'var l10n$test = { en: "Test", nyan: "Meow" }; __(__.$("test", l10n$test));'
)
test('__.zzz("test")', '__.zzz("test");')
test(
  '__.string("test")',
  'var l10n$test = { en: "Test", nyan: "Meow" }; __.string(__.$("test", l10n$test));'
)
test(
  '__.template("test")',
  'var l10n$test = { en: "Test", nyan: "Meow" }; __.template(__.$("test", l10n$test));'
)
test(
  '__.dual(1, "test", "hello")',
  'var l10n$test = { en: "Test", nyan: "Meow" }, l10n$hello = { en: "Hello", nyan: "Nyan" };' +
  '__.dual(1, __.$("test", l10n$test), __.$("hello", l10n$hello));'
)
test(
  '__.dual.string(1, "test", "hello")',
  'var l10n$test = { en: "Test", nyan: "Meow" }, l10n$hello = { en: "Hello", nyan: "Nyan" };' +
  '__.dual.string(1, __.$("test", l10n$test), __.$("hello", l10n$hello));'
)
test(
  '__("test", { x: __("hello") })',
  'var l10n$test = { en: "Test", nyan: "Meow" }, l10n$hello = { en: "Hello", nyan: "Nyan" };' +
  '__(__.$("test", l10n$test), { x: __(__.$("hello", l10n$hello)) });'
)

// Ensures that the transformer doesn't break when the l10nData has a key that
// normalizes similarly.
test(
  'let x = () => [__("a+1"), __.string("a-1")]',
  'var l10n$a_1 = {}, l10n$a_1_ = {};' +
  'var x = function () { return [__(__.$("a+1", l10n$a_1)), __.string(__.$("a-1", l10n$a_1_))]; };'
)

it('runs the example in README', async () => {
  const readme = require('fs').readFileSync('README.md', 'utf8')
  const prettier = require('prettier')
  let inputCode
  let expectedCode
  readme.replace(
    /```js\s*((?:function Tutorial|var l10n)[^]*?)```/g,
    (a, code) => {
      if (!inputCode) inputCode = code.trim()
      else if (!expectedCode) expectedCode = code.trim()
    }
  )
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
