import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { ContextForm } from "@/components/context-form";
import { defaultContext } from "@/lib/schemas";

describe("ContextForm", () => {
  it("exposes clear labels and has no detectable accessibility violations", async () => {
    const { container } = render(
      <ContextForm context={defaultContext} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Your work")).toBeVisible();
    expect(screen.getByText("Choose two priorities")).toBeVisible();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
