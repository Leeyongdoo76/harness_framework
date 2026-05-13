import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImprovementsCard from "./ImprovementsCard";

describe("ImprovementsCard", () => {
  it("renders empty state when no improvements", () => {
    render(<ImprovementsCard improvements={[]} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("개선할 점");
    expect(
      screen.getByText("뚜렷한 개선 요구 패턴이 발견되지 않았습니다"),
    ).toBeInTheDocument();
  });

  it("toggles evidence list", async () => {
    const user = userEvent.setup();
    render(
      <ImprovementsCard
        improvements={[
          {
            point: "오디오 레벨이 들쑥날쑥",
            evidence: ["볼륨 너무 작음", "BGM이 음성을 가립니다"],
          },
        ]}
      />,
    );
    expect(screen.queryByText("BGM이 음성을 가립니다")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(screen.getByText("BGM이 음성을 가립니다")).toBeInTheDocument();
  });
});
