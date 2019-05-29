const ts = require('typescript')

/**
 * @typedef {Object} Options
 * @prop {any} l10nData Localization data in the format of
 *  `{ [language: string]: { [key: string]: string } }`
 */

/**
 * @type {(options: Options) => import('typescript').TransformerFactory<import('typescript').SourceFile>}
 * @see https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943
 */
const transformer = options => transformationContext => sourceFile => {
  /**
   * @param {import('typescript').Node} node
   */
  const matchL10nNode = node => {
    if (!ts.isCallExpression(node)) return null

    if (ts.isIdentifier(node.expression)) {
      // a(*)
      const a = node.expression.text
      if (a === '__') {
        return [node.arguments[0]]
      }
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      const access = node.expression
      if (ts.isIdentifier(access.expression) && ts.isIdentifier(access.name)) {
        // a.b(*)
        const a = access.expression.text
        const b = access.name.text
        if (a === '__' && (b === 'string' || b === 'template')) {
          return [node.arguments[0]]
        }
        if (a === '__' && b === 'dual') {
          return [node.arguments[1], node.arguments[2]]
        }
      } else if (
        ts.isPropertyAccessExpression(access.expression) &&
        ts.isIdentifier(access.expression.expression) &&
        ts.isIdentifier(access.expression.name)
      ) {
        // a.b.c(*)
        const a = access.expression.expression.text
        const b = access.expression.name.text
        const c = access.name.text
        if (a === '__' && b === 'dual' && c === 'string') {
          return [node.arguments[1], node.arguments[2]]
        }
      }
    }
    return null
  }
  const visitor = node => {
    const match = matchL10nNode(node)
    if (match) {
      return ts.updateCall(
        node,
        node.expression,
        undefined,
        node.arguments.map(arg => {
          if (match.includes(arg)) {
            if (!ts.isStringLiteral(arg)) {
              return ts.visitEachChild(arg, visitor, transformationContext)
            }
            const properties = []
            for (const language of Object.keys(options.l10nData)) {
              const foundText = options.l10nData[language][arg.text]
              if (foundText && typeof foundText === 'string') {
                const stringLiteralNode = ts.createStringLiteral(foundText)
                ts.setEmitFlags(stringLiteralNode, ts.EmitFlags.NoAsciiEscaping)
                properties.push(
                  ts.createPropertyAssignment(language, stringLiteralNode)
                )
              }
            }
            return ts.createCall(
              ts.createPropertyAccess(ts.createIdentifier('__'), '$'),
              [],
              [arg, ts.createObjectLiteral(properties)]
            )
          } else {
            return ts.visitEachChild(arg, visitor, transformationContext)
          }
        })
      )
    }
    return ts.visitEachChild(node, visitor, transformationContext)
  }
  return ts.visitNode(sourceFile, visitor)
}

module.exports = transformer
