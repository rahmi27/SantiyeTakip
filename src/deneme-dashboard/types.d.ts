export interface DenemeQuantityFields {
  sihhiGrupSayisi: number;
  dalgicPompaSayisi: number;
  yagTutucuSayisi: number;
  vrfDrenajMetraji: number;
  petekSayisi: number;
  kollektorSayisi: number;
  sprinkSayisi: number;
  yanginDolabiSayisi: number;
  ibaSayisi: number;
  araIstasyonMetraji: number;
  karotDeligiSayisi: number;
}

export interface DenemeBuilding {
  id: string;
  code: string;
  name: string;
  lineColor: string;
  quantities: DenemeQuantityFields;
  automaticCategoryWeights: Record<string, number>;
  coordinates: [number, number][];
}

export interface DenemeWorkTemplate {
  id: string;
  name: string;
  sectionPercentage: number;
}
