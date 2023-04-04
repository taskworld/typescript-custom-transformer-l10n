import * as ts from 'typescript'

/**
 * @see https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943
 */
const transformer =
  (options: {
    l10nData: { [language: string]: { [key: string]: string } }
  }): ts.TransformerFactory<ts.SourceFile> =>
  (transformationContext) =>
  (sourceFile) => {
    const matchL10nNode = (node: ts.Node) => {
      if (!ts.isCallExpression(node)) return null

      if (ts.isIdentifier(node.expression)) {
        // a(*)
        const a = node.expression.text
        if (a === '__') {
          return [node.arguments[0]]
        }
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const access = node.expression
        if (
          ts.isIdentifier(access.expression) &&
          ts.isIdentifier(access.name)
        ) {
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

    const l10nObjects: { [variableName: string]: ts.ObjectLiteralExpression } =
      {}
    const l10nVariableNames: { [variableName: string]: string } = {}

    function getVariableName(key: string) {
      let candidateName = `l10n\$${key.replace(/[^a-z0-9]+/g, '_')}`
      for (
        ;
        l10nVariableNames[candidateName] &&
        l10nVariableNames[candidateName] !== key;
        candidateName += '_'
      ) {
        // This variable name is already used by another key.
        // We need to find a new one.
      }
      l10nVariableNames[candidateName] = key
      return candidateName
    }

    const visitor: ts.Visitor = (node) => {
      const match = matchL10nNode(node)
      if (match) {
        const callExprNode = node as ts.CallExpression
        return transformationContext.factory.updateCallExpression(
          callExprNode,
          callExprNode.expression,
          undefined,
          callExprNode.arguments.map((arg) => {
            if (match.includes(arg)) {
              if (!ts.isStringLiteral(arg)) {
                return ts.visitEachChild(arg, visitor, transformationContext)
              }
              const key = arg.text
              const variableName = getVariableName(key)
              const variableReference =
                transformationContext.factory.createIdentifier(variableName)

              if (!l10nObjects[variableName]) {
                const properties: ts.ObjectLiteralElementLike[] = []
                for (const language of Object.keys(options.l10nData)) {
                  const foundText = options.l10nData[language][arg.text]
                  if (foundText && typeof foundText === 'string') {
                    const stringLiteralNode =
                      transformationContext.factory.createStringLiteral(
                        foundText
                      )
                    ts.setEmitFlags(
                      stringLiteralNode,
                      ts.EmitFlags.NoAsciiEscaping
                    )
                    properties.push(
                      transformationContext.factory.createPropertyAssignment(
                        language,
                        stringLiteralNode
                      )
                    )
                  }
                }
                const object =
                  transformationContext.factory.createObjectLiteralExpression(
                    properties
                  )
                l10nObjects[variableName] = object
              }
              return transformationContext.factory.createCallExpression(
                transformationContext.factory.createPropertyAccessExpression(
                  transformationContext.factory.createIdentifier('__'),
                  '$'
                ),
                [],
                [arg, variableReference]
              )
            } else {
              return ts.visitEachChild(arg, visitor, transformationContext)
            }
          })
        )
      }
      return ts.visitEachChild(node, visitor, transformationContext)
    }

    const transformed = ts.visitNode(sourceFile, visitor)

    const entries = Object.entries(l10nObjects)
    if (entries.length > 0) {
      return transformationContext.factory.updateSourceFile(transformed, [
        transformationContext.factory.createVariableStatement(
          [],
          transformationContext.factory.createVariableDeclarationList(
            Object.entries(l10nObjects).map(([variableName, object]) =>
              transformationContext.factory.createVariableDeclaration(
                variableName,
                undefined,
                undefined,
                object
              )
            ),
            ts.NodeFlags.Const
          )
        ),
        ...transformed.statements,
      ])
    } else {
      return transformed
    }
  }

export default transformer
