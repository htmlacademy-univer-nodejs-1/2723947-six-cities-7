export function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Нельзя выбрать элемент пустого массива');
  }
  return items[randomInteger(0, items.length - 1)];
}

export function randomItems<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = randomInteger(0, index);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, randomInteger(1, shuffled.length));
}
