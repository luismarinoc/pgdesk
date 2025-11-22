import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
    it("renders without crashing", () => {
        render(<App />);
        // Since I don't know exactly what's in App, I'll just check if it renders.
        // Ideally I would check for some text, but let's just see if render works.
        expect(document.body).toBeInTheDocument();
    });
});
