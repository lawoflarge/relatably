import { palette, typography, sp, radii, shadow, motion } from "./tokens";

describe("Sticker Pop tokens", () => {
  it("exposes the 10 palette colors with stable hex values", () => {
    expect(palette.cream).toBe("#FFF7E8");
    expect(palette.cream2).toBe("#FBEED1");
    expect(palette.ink).toBe("#1A1A1A");
    expect(palette.inkSoft).toBe("#4A4541");
    expect(palette.pink).toBe("#FF4FA3");
    expect(palette.lemon2).toBe("#FFD43B");
    expect(palette.lemon).toBe("#FFDF6B");
    expect(palette.mint).toBe("#7AE6C3");
    expect(palette.blue).toBe("#7BC8F6");
    expect(palette.red).toBe("#FF5A4F");
  });

  it("exposes the type scale with hero/h1/h2/h3/body/label/micro", () => {
    expect(typography.hero.size).toBe(52);
    expect(typography.hero.line).toBe(50);
    expect(typography.h3.size).toBe(22);
    expect(typography.body.size).toBe(15);
    expect(typography.label.size).toBe(11);
    expect(typography.micro.size).toBe(9);
  });

  it("exposes 8-step spacing scale", () => {
    expect(sp[1]).toBe(4);
    expect(sp[4]).toBe(16);
    expect(sp[8]).toBe(64);
  });

  it("exposes the screen gutter as 22", () => {
    expect(sp.gutter).toBe(22);
  });

  it("exposes radii", () => {
    expect(radii.s).toBe(14);
    expect(radii.m).toBe(22);
    expect(radii.l).toBe(28);
    expect(radii.xl).toBe(36);
    expect(radii.pill).toBe(999);
  });

  it("exposes hard-offset shadows with zero blur", () => {
    expect(shadow.s).toEqual({ color: "#1A1A1A", offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 });
    expect(shadow.m).toEqual({ color: "#1A1A1A", offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 });
    expect(shadow.l).toEqual({ color: "#1A1A1A", offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 });
  });

  it("exposes motion timing constants", () => {
    expect(motion.tap.duration).toBe(120);
    expect(motion.spring.duration).toBe(200);
    expect(motion.wobble.duration).toBe(4000);
  });
});
