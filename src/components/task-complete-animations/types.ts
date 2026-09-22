export interface AnimEffectProps {
  origin: { x: number; y: number; width: number; height: number };
  title: string;
  onDone: () => void;
}
