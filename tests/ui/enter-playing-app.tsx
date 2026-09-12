import { render, fireEvent, screen } from "@testing-library/react";
// Existing board regressions enter through the real Home controls. Home itself
// has separate tests; this helper does not bypass production navigation/state.
export const renderPlayingApp: typeof render = ((...args: Parameters<typeof render>) => {
  const view = render(...args);
  const next =
    screen.queryByRole("button", { name: "Resume game", exact: true }) ??
    screen.queryByRole("button", { name: "View result", exact: true }) ??
    screen.queryByRole("button", { name: "View saved game", exact: true }) ??
    screen.queryByRole("button", { name: "New game", exact: true });
  if (next) fireEvent.click(next);
  return view;
}) as typeof render;
