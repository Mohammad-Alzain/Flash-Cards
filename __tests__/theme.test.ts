import { lightColors, darkColors, amoledColors, typography, spacing, radius } from '../src/theme/tokens';

describe('Design Tokens verification', () => {
  test('all themes have identical color keys', () => {
    const lightKeys = Object.keys(lightColors).sort();
    const darkKeys = Object.keys(darkColors).sort();
    const amoledKeys = Object.keys(amoledColors).sort();

    expect(darkKeys).toEqual(lightKeys);
    expect(amoledKeys).toEqual(lightKeys);
  });

  test('AMOLED theme has pure black background', () => {
    expect(amoledColors.background).toBe('#000000');
  });

  test('Chunky 3D button elevation tokens exist', () => {
    expect(lightColors.primaryPressed).toBeDefined();
    expect(lightColors.secondaryPressed).toBeDefined();
    expect(lightColors.errorPressed).toBeDefined();
  });

  test('Typography scale and weights are defined correctly', () => {
    expect(typography.sizes.md).toBe(16);
    expect(typography.sizes.lg).toBe(18);
    expect(typography.sizes.xxl).toBe(28);
    expect(typography.weights.bold).toBe('700');
  });

  test('Spacing and radius conform to 8B specs', () => {
    expect(radius.md).toBe(12); // Inputs
    expect(radius.lg).toBe(16); // Buttons/Cards
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
  });
});
