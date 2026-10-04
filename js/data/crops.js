// Crops grown on farm plots. time = seconds to ripen at normal speed; stages: 0 seed .. 3 ripe.
export const CROPS = {
  wheat: { name: 'Wheat', time: 90, yield: [2, 4], item: 'wheat', regrow: false },
  carrot: { name: 'Carrot', time: 110, yield: [2, 3], item: 'carrot', regrow: false },
  tomato: { name: 'Tomato', time: 140, yield: [2, 3], item: 'tomato', regrow: true },
  pumpkin: { name: 'Pumpkin', time: 200, yield: [1, 2], item: 'pumpkin', regrow: false },
  strawberry: { name: 'Strawberry', time: 160, yield: [2, 4], item: 'strawberry', regrow: true },
  cotton: { name: 'Cotton', time: 120, yield: [2, 3], item: 'cotton', regrow: true },
};
export const cropStage = (c, g) => (c ? Math.min(3, Math.floor((g / CROPS[c].time) * 3.999)) : 0);
