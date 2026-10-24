import { applyEdits, format, Node, parseTree, ParseError, printParseErrorCode } from 'jsonc-parser';
import { JsonInspection, JsonTreeNode } from '../models/json-inspection';
import { unwrapSerializedJson } from './decode-serialized-json';

function mapNode(node: Node, label: string): JsonTreeNode {
  const children =
    node.type === 'object'
      ? (node.children ?? []).map((property) =>
          mapNode(property.children![1]!, String(property.children![0]!.value)),
        )
      : (node.children ?? []).map((child, index) => mapNode(child, String(index)));
  return {
    kind: node.type as JsonTreeNode['kind'],
    label,
    offset: node.offset,
    length: node.length,
    children,
  };
}

export function inspectJson(source: string): JsonInspection {
  try {
    const errors: ParseError[] = [];
    const node = parseTree(source, errors, {
      disallowComments: true,
      allowTrailingComma: false,
      allowEmptyContent: false,
    });
    if (!node || errors.length) {
      const first = errors[0];
      return {
        valid: false,
        root: null,
        pretty: '',
        error: first
          ? `${printParseErrorCode(first.error)} at character ${first.offset + 1}`
          : 'Not a JSON value',
      };
    }
    return {
      valid: true,
      root: mapNode(node, '$'),
      pretty: applyEdits(
        source,
        format(source, undefined, { tabSize: 2, insertSpaces: true, eol: '\n' }),
      ),
      error: '',
    };
  } catch {
    return {
      valid: false,
      root: null,
      pretty: '',
      error: 'This value is too deeply nested to inspect. Its raw text is unchanged.',
    };
  }
}

export function decodeNestedJson(source: string, node: JsonTreeNode): string | null {
  if (node.kind !== 'string') return null;
  try {
    const decoded: unknown = JSON.parse(source.slice(node.offset, node.offset + node.length));
    return typeof decoded === 'string' &&
      unwrapSerializedJson(source.slice(node.offset, node.offset + node.length)).source !== null
      ? decoded
      : null;
  } catch {
    return null;
  }
}
