# Deck Simulator

An interactive poker hand simulator written in TypeScript. It deals five-card hands from a 62-card deck (52 standard cards plus 10 wildcards), lets you choose which cards to hold, evaluates the result, and tracks payouts and hand types.

## Requirements

- Node.js and npm
- Dependencies are installed with `npm install`

## Getting Started

```bash
npm install
npm start
```

`npm start` runs the TypeScript source directly through `ts-node`, so no build step is needed.

## Card Display Styles

The default display shows compact, colored cards on one line:

```bash
npm start
# or
npx ts-node deck.ts --plain
```

For boxed cards, use `--fancy`:

```bash
npm run start:fancy
```

For a larger card layout, use `--large`:

```bash
npm run start:large
# or
npx ts-node deck.ts --large
```

`--big` and `--large-cards` are aliases for `--large`. If multiple style flags are passed, the last one wins.

Example large cards:

```text
┌───────────┐ ┌───────────┐ ┌───────────┐
│ A         │ │ 10        │ │ WC        │
│           │ │           │ │           │
│     ♥     │ │     ♦     │ │     ★     │
│           │ │           │ │           │
│         A │ │        10 │ │        WC │
└───────────┘ └───────────┘ └───────────┘
```

## How to Play

1. Enter a bet between `1` and your current balance.
2. You are dealt five cards. The game suggests cards to hold, marked with `✓`.
3. Press `1`–`5` to toggle whether each card is held.
4. Press `Enter` to draw replacements for the cards you did not hold.
5. The hand is evaluated and the payout is applied to your balance.
6. On a winning hand, you can optionally gamble the winnings:
   - `↑` or `h` — guess the next card is higher
   - `↓` or `l` — guess the next card is lower
   - `Space` or `s` — stand and keep the current winnings

Press `q` to quit when prompted, or `Ctrl+C` at any time. The balance starts at 100.

## Payouts

Winnings are the payout multiplier multiplied by your bet.

| Hand | Payout |
| --- | ---: |
| Five of a Kind | 1000x |
| Royal Flush | 800x |
| Straight Flush | 50x |
| Four of a Kind | 25x |
| Full House | 10x |
| Flush | 8x |
| Straight | 5x |
| Three of a Kind | 3x |
| Two Pair | 2x |
| High Pair (Jacks or better) | 1x |
| One Pair | 0x |
| High Card | 0x |

`Five of a Kind` requires wildcards. `High Pair` means a pair of Jacks, Queens, Kings, or Aces.

## Build

Compile the TypeScript source to JavaScript:

```bash
npm run build
```

This writes `dist/deck.js`. You can run the compiled version with:

```bash
node dist/deck.js --large
# or, since package.json points "main" at dist/deck.js:
node . --large
```

Use `npx tsc --noEmit` to type-check without writing output.

## Project Layout

```text
deck.ts        TypeScript source and game logic
dist/deck.js   Compiled JavaScript output from npm run build
package.json   Scripts, dependencies, and package entry point
tsconfig.json  TypeScript compiler configuration
```
