export type MapCoordinate = [x: number, y: number];

export interface Bina {
  id: string;
  code: string;
  name: string;
  lineColor: string;
  coordinates: MapCoordinate[];
  progress: Record<string, number>;
}

export interface VaziyetPlani {
  image: string;
  width: number;
  height: number;
}
