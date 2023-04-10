import * as ts from 'typescript'

type LocalizationKey = string
type LocalizationText = string
type LocalizationData = {
  readonly [language: string]: {
    readonly [key: LocalizationKey]: LocalizationText
  }
}

/**
 * @see https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943
 */
export default function transformer(options: {
  l10nData: LocalizationData
}): ts.TransformerFactory<ts.SourceFile> {
  return (transformationContext) => (sourceFile) => {
    const getUniqueIdentifierName = createGetUniqueIdentifierName()

    const foundKeys = new Set<LocalizationKey>()

    // Replace `'key'` as in `__('key')` with `__.$('key', l10n$key)`
    const tryReplaceLocalizationKey: ts.Visitor<ts.Node, ts.Node> = (node) => {
      if (ts.isCallExpression(node)) {
        const keyNodes = getLocalizationKeyNodes(node)
        if (keyNodes.length > 0) {
          return transformationContext.factory.updateCallExpression(
            node,
            node.expression,
            undefined,
            node.arguments.map((argumentNode) => {
              // Pass through existing arguments which are not localization keys
              if (
                !ts.isStringLiteral(argumentNode) ||
                !keyNodes.includes(argumentNode)
              ) {
                return ts.visitEachChild(
                  argumentNode,
                  tryReplaceLocalizationKey,
                  transformationContext
                )
              }

              const keyNode = argumentNode
              const key: LocalizationKey = keyNode.text
              const identifier = transformationContext.factory.createIdentifier(
                getUniqueIdentifierName(key)
              )

              foundKeys.add(key)

              // Swap `'key'` argument with `__.$('key', l10n$key)`
              // where `l10n$key` is an identifier refers to the top-level object declaration
              return transformationContext.factory.createCallExpression(
                transformationContext.factory.createPropertyAccessExpression(
                  transformationContext.factory.createIdentifier('__'),
                  '$'
                ),
                [],
                [keyNode, identifier]
              )
            })
          )
        }
      }

      return ts.visitEachChild(
        node,
        tryReplaceLocalizationKey,
        transformationContext
      )
    }

    const modifiedFileNode = ts.visitNode(
      sourceFile,
      tryReplaceLocalizationKey
    ) as ts.SourceFile

    // Return the original file if no localization keys found
    if (foundKeys.size === 0) {
      return sourceFile
    }

    // Inject `const l10n$key1 = { en: 'text', th: 'ข้อความ', ... }, l10n$key2 = { ... }, ...` at the top of the file
    return transformationContext.factory.updateSourceFile(modifiedFileNode, [
      transformationContext.factory.createVariableStatement(
        [],
        transformationContext.factory.createVariableDeclarationList(
          Array.from(foundKeys).map((key) => {
            const identifierName = getUniqueIdentifierName(key)
            const object = createTranslationLookupObject(key, options.l10nData)

            return transformationContext.factory.createVariableDeclaration(
              identifierName,
              undefined,
              undefined,
              object
            )
          }),
          ts.NodeFlags.Const
        )
      ),
      ...modifiedFileNode.statements,
    ])
  }
}

/**
 * Creates a function that returns a JavaScript identifier-compatible name
 * derived from the localization key.
 *
 * Given the same key, the same derived string will be returned.
 */
function createGetUniqueIdentifierName() {
  const usedNameMap: { [identifierName: string]: LocalizationKey } = {}

  return (key: LocalizationKey) => {
    let name = `l10n\$${key.replace(/[^a-z0-9]+/g, '_')}`
    for (; usedNameMap[name] && usedNameMap[name] !== key; name += '_') {
      // This variable name is already used by another key.
      // We need to find a new one.
    }

    usedNameMap[name] = key

    return name
  }
}

/**
 * Returns all possible localization key nodes as in `__('key', ...)` or
 * `__.dual('key1', 'key2', ...)` or similar kind.
 * @see https://github.com/taskworld/tw-frontend/blob/master/client/src/tw-localization/__.tsx
 */
function getLocalizationKeyNodes(node: ts.CallExpression): ts.StringLiteral[] {
  if (ts.isIdentifier(node.expression)) {
    // __('key', ...)
    const a = node.expression.text
    if (a === '__') {
      return [node.arguments[0]].filter(ts.isStringLiteral)
    }
  } else if (ts.isPropertyAccessExpression(node.expression)) {
    const access = node.expression
    if (ts.isIdentifier(access.expression) && ts.isIdentifier(access.name)) {
      // __.string('key', ...)
      // __.template('key', ...)
      // __.dual('key1', 'key2', ...)
      const a = access.expression.text
      const b = access.name.text
      if (a === '__' && (b === 'string' || b === 'template')) {
        return [node.arguments[0]].filter(ts.isStringLiteral)
      }
      if (a === '__' && b === 'dual') {
        return [node.arguments[1], node.arguments[2]].filter(ts.isStringLiteral)
      }
    } else if (
      ts.isPropertyAccessExpression(access.expression) &&
      ts.isIdentifier(access.expression.expression) &&
      ts.isIdentifier(access.expression.name)
    ) {
      // __.dual.string('key1', 'key2', ...)
      const a = access.expression.expression.text
      const b = access.expression.name.text
      const c = access.name.text
      if (a === '__' && b === 'dual' && c === 'string') {
        return [node.arguments[1], node.arguments[2]].filter(ts.isStringLiteral)
      }
    }
  }
  return []
}

/**
 * Returns a TypeScript object literal that the fields are language code
 * and the values are local text for the given key.
 * @example { en: 'text', th: 'ข้อความ', ... }
 */
function createTranslationLookupObject(
  key: LocalizationKey,
  l10nData: LocalizationData
) {
  return ts.factory.createObjectLiteralExpression(
    Object.keys(l10nData)
      .map((language) => {
        const text = l10nData[language][key]
        if (typeof text === 'string') {
          const stringNode = ts.factory.createStringLiteral(text)
          ts.setEmitFlags(stringNode, ts.EmitFlags.NoAsciiEscaping)
          return ts.factory.createPropertyAssignment(language, stringNode)
        }
      })
      .filter((entry): entry is ts.PropertyAssignment => !!entry)
  )
}
