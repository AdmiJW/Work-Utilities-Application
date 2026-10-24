export interface SqlToken {
  kind: 'word' | 'quoted' | 'string' | 'symbol' | 'space' | 'comment';
  text: string;
  start: number;
  end: number;
}
