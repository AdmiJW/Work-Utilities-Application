export interface JsonTreeNode {
  kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  label: string;
  offset: number;
  length: number;
  children: JsonTreeNode[];
}

export interface JsonInspection {
  valid: boolean;
  pretty: string;
  root: JsonTreeNode | null;
  error: string;
}

export type JsonDecodeMode = 'shallow' | 'deep';
export interface JsonInspectionView {
  inspection: JsonInspection;
  source: string;
  notice: string;
}
