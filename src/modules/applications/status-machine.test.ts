import { describe, it, expect } from "vitest";
import { canTransition } from "./status-machine";
import { ApplicationStatus } from "./application.schema";

describe("canTransition", () => {
  it("allows APPLIED to move to SCREENING", () => {
    expect(canTransition("APPLIED", "SCREENING")).toBe(true);
  });

  it("allows INTERVIEW to move to the OFFER", () => {
    expect(canTransition("INTERVIEW", "OFFER")).toBe(true);
  });
  it("allows OFFER to move to the ACCEPTED", () => {
    expect(canTransition("OFFER", "ACCEPTED")).toBe(true);
  });
  it("disallows REJECTED to move to SCREENING", () => {
    expect(canTransition("REJECTED", "SCREENING")).toBe(false);
  });
  it("disallows WITHDRAWN to move to SCREENING", () => {
    expect(canTransition("WITHDRAWN", "SCREENING")).toBe(false);
  });
  it("disallows REJECTED to move to the OFFER", () => {
    expect(canTransition("REJECTED", "OFFER")).toBe(false);
  });
  it("disallows WITHDRAWN to move to the OFFER", () => {
    expect(canTransition("WITHDRAWN", "OFFER")).toBe(false);
  });
  it("disallows WITHDRAWN to move to the ACCEPTED", () => {
    expect(canTransition("WITHDRAWN", "ACCEPTED")).toBe(false);
  });
  it("allows OFFER to move to the REJECTED", () => {
    expect(canTransition("OFFER", "REJECTED")).toBe(true);
  });
  it("allows APPLIED to move to the REJECTED", () => {
    expect(canTransition("APPLIED", "REJECTED")).toBe(true);
  });
  it("allows APPLIED to move to the WITHDRAWN", () => {
    expect(canTransition("APPLIED", "WITHDRAWN")).toBe(true);
  });
  it("allows SCREENING to move to the INTERVIEW", () => {
    expect(canTransition("SCREENING", "INTERVIEW")).toBe(true);
  });
  it("allows SCREENING to move to the REJECTED", () => {
    expect(canTransition("SCREENING", "REJECTED")).toBe(true);
  });
  it("allows SCREENING to move to the WITHDRAWN", () => {
    expect(canTransition("SCREENING", "WITHDRAWN")).toBe(true);
  });
  it("allows INTERVIEW to move to the REJECTED", () => {
    expect(canTransition("INTERVIEW", "REJECTED")).toBe(true);
  });
  it("allows INTERVIEW to move to the WITHDRAWN", () => {
    expect(canTransition("INTERVIEW", "WITHDRAWN")).toBe(true);
  });
});
describe("terminal states cannot transition to anything", () => {
  const allStatuses: ApplicationStatus[] = [
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "OFFER",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
  ];

  // ACCEPTED is terminal
  allStatuses.forEach((target) => {
    it(`disallows ACCEPTED to move to ${target}`, () => {
      expect(canTransition("ACCEPTED", target)).toBe(false);
    });
    it(`disallows REJECTED to move to ${target}`, () => {
      expect(canTransition("REJECTED", target)).toBe(false);
    });
    it(`disallows WITHDRAWN to move to ${target}`, () => {
      expect(canTransition("WITHDRAWN", target)).toBe(false);
    });
  });
});
