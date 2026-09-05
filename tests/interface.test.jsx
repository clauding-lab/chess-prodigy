import React from "react";
import { render, fireEvent, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadPrototype, fromFEN, play } from "./prototype.js";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-05T06:00:00+06:00")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function mount(initialGame) {
  const api = loadPrototype(initialGame);
  const view = render(<api.default />);
  await act(async () => {});
  return { ...view, api };
}
function pauseCoach() { fireEvent.click(screen.getByText("Live", {exact:true})); }
function square(container, name) {
  const i = (8-Number(name[1]))*8 + "abcdefgh".indexOf(name[0]);
  return container.querySelectorAll(".sq")[i];
}
it("charges actual elapsed time when timer callbacks are delayed", async () => {
  const {container} = await mount(g => ({...g, started:true, setup:{...g.setup,time:"5+0"},clocks:{w:10000,b:10000}}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  pauseCoach();
  act(() => { vi.setSystemTime(Date.now()+5000); vi.advanceTimersByTime(200); });
  expect(container.querySelectorAll(".clock")[1].textContent).toBe("0:05");
});
it("a pending promotion cannot revive a timed-out game", async () => {
  const {container} = await mount(g=>({...g,st:fromFEN("7k/P7/8/8/8/8/8/4K3 w - - 0 1"),started:true,setup:{...g.setup,time:"5+0"},clocks:{w:200,b:10000}}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  pauseCoach();
  fireEvent.click(square(container,"a7")); fireEvent.click(square(container,"a8"));
  expect(screen.getByText("Promote to")).toBeTruthy();
  act(()=>vi.advanceTimersByTime(200));
  const promote = container.querySelector(".promo button");
  if(promote) fireEvent.click(promote);
  expect(container.querySelector(".status").textContent).toContain("Time out");
  expect(square(container,"a7").textContent).toContain("♟");
  expect(container.querySelector(".promo")).toBeNull();
});
it("cancels a queued review before a new game replaces its history", async () => {
  const api = loadPrototype();
  const {container} = await mount(g => ({...play(api,g,"e4 e5 Nf3 Nc6 Bc4 Nf6 d3 d6"), evals:{}}));
  // Review is reachable while setup is open; close it to use the normal controls.
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  pauseCoach();
  fireEvent.click(screen.getByText("Off",{exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Review game"}));
  fireEvent.click(screen.getByRole("button",{name:"Close"}));
  fireEvent.click(screen.getByRole("button",{name:"New game"}));
  fireEvent.click(screen.getByRole("button",{name:"Start"}));
  // Discard old review work before it can address move 1 of the new empty history.
  expect(()=>act(()=>vi.advanceTimersByTime(40))).not.toThrow();
  expect(container.querySelector(".movelist").textContent).toContain("Moves appear here");
  expect(screen.queryByText("Analysing…")).toBeNull();
});
it("puts Black's player bar beside Black's pieces before and after flipping", async () => {
  const {container}=await mount();
  fireEvent.click(screen.getByRole("button",{name:"Black",exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Start"}));
  expect(container.querySelectorAll(".playerbar")[1].textContent).toContain("You");
  expect(container.querySelectorAll(".sq")[63].querySelector(".pc").classList.contains("b")).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Flip"}));
  expect(container.querySelectorAll(".playerbar")[0].textContent).toContain("You");
  expect(container.querySelectorAll(".sq")[0].querySelector(".pc").classList.contains("b")).toBe(true);
});

it("cancels review between batches when the game is replaced", async () => {
  const api = loadPrototype();
  const {container}=await mount(g=>({...play(api,g,"e4 e5 Nf3 Nc6 Bc4 Nf6 d3 d6"),evals:{}}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Review game"}));
  act(()=>vi.advanceTimersByTime(30));
  expect(screen.getByText("Analysing…")).toBeTruthy();
  // Dispatch the real restart controls without the close action, to isolate restart cancellation.
  fireEvent.click(screen.getByRole("button",{name:"New game"}));
  fireEvent.click(screen.getByRole("button",{name:"Start"}));
  expect(()=>act(()=>vi.advanceTimersByTime(150))).not.toThrow();
  expect(container.querySelector(".movelist").textContent).toContain("Moves appear here");
  expect(screen.queryByText("Analysing…")).toBeNull();
});
it("cancels review when undo changes its history", async () => {
  const api=loadPrototype();
  const {container}=await mount(g=>({...play(api,g,"e4 e5 Nf3 Nc6 Bc4 Nf6 d3 d6"),evals:{}}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Review game"}));
  fireEvent.click(screen.getByRole("button",{name:"Undo"}));
  expect(()=>act(()=>vi.advanceTimersByTime(150))).not.toThrow();
  expect(container.querySelector(".movelist").textContent).not.toContain("d6");
  expect(screen.queryByText("Analysing…")).toBeNull();
});
it("cleans up queued review work when unmounted", async () => {
  const api=loadPrototype();
  const {unmount}=await mount(g=>({...play(api,g,"e4 e5 Nf3 Nc6"),evals:{}}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Review game"}));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not replay move audio when sound is enabled or a move is undone", async () => {
  let tones=0;
  class AudioContext {
    currentTime=0;destination={};
    createOscillator(){return {frequency:{value:0},connect(){},start(){tones++;},stop(){}};}
    createGain(){return {gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}};}
  }
  vi.stubGlobal("AudioContext",AudioContext);
  const api=loadPrototype();
  await mount(g=>play(api,g,"e4 e5"));
  const initial=tones;
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Sound on"}));
  fireEvent.click(screen.getByRole("button",{name:"Sound off"}));
  expect(tones).toBe(initial);
  fireEvent.click(screen.getByRole("button",{name:"Undo"}));
  expect(tones).toBe(initial);
  vi.unstubAllGlobals();
});

it("plays the first move sound after starting a new game", async () => {
  let tones=0;
  class AudioContext {
    currentTime=0;destination={};
    createOscillator(){return {frequency:{value:0},connect(){},start(){tones++;},stop(){}};}
    createGain(){return {gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}};}
  }
  vi.stubGlobal("AudioContext",AudioContext);
  const {container}=await mount();
  fireEvent.click(screen.getByRole("button",{name:"Start"}));
  fireEvent.click(square(container,"e2"));fireEvent.click(square(container,"e4"));
  expect(tones).toBe(1);
  vi.unstubAllGlobals();
});
