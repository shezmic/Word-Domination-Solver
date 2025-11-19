# INSTRUCTION: Port Quackle Logic to Word Domination Solver (Rust)

## Context
I am building a solver for **Word Domination** (MAG Interactive). This is *not* standard Scrabble. It is a 5-round, real-time blitz game with "Booster Cards."
I want to use **Quackle's** C++ engine for its speed and move generation, but I need to completely rewrite the strategy layer to fit this specific game.

## The Core Difference (Crucial)
* **Scrabble (Quackle):** Long game (~15 turns). Strategy = Rack Balance + Bag Management.
* **Word Domination (My App):** Short game (Exactly 5 rounds). Strategy = Maximize Score NOW + Booster combos. Area control/Bag tracking is irrelevant.

## Phase 1: The Engine (Keep This)
**Reference Quackle:** `quackle/library/movegenerator.cpp` (GADDAG)
**Task:**
1.  Your existing GADDAG implementation is correct. Keep it.
2.  Port Quackle's **"Anchor" logic**.
    * *Explanation:* Quackle doesn't just check every square. It identifies "Anchors" (empty squares adjacent to existing tiles) and only generates moves from those. This cuts search time by 90%.
    * *Action:* Ensure my `MoveGenerator` struct iterates *only* over pre-calculated anchor squares, not the whole board.

## Phase 2: The Evaluation (Modify This)
**Reference Quackle:** `quackle/library/evaluator.cpp` (Static Evaluation)
**Task:**
1.  **Scrabble Logic to DELETE:** Remove any "Endgame" logic (emptying the bag). Remove "Synergy" penalties (in Scrabble, keeping a 'Q' is bad; in Word Domination, you might just need to burn it now).
2.  **New "Blitz" Heuristic:**
    * Create a `LeaveEvaluator` that changes based on the round number.
    * *Rounds 1-3:* Use standard leave values (keep 'S', 'E', 'R').
    * *Round 4:* Discount leave values by 50% (Prioritize points).
    * *Round 5:* **Zero** leave values. Pure Greedy search (Points only).

## Phase 3: The Meta-Layer (The "Booster" Logic)
**Context:** This is the unique part of Word Domination. Quackle has no code for this.
**Task:**
1.  Create a `Booster` enum in `src/types.rs` to represent the game's power-ups:
    ```rust
    pub enum Booster {
        FreezeTime,         // Adds +15s (Allows deeper search depth)
        BonusTile,          // Turns a tile into a DL/TL/DW/TW
        Rocket,             // Destroys a specific tile
        RefreshRack,        // New tiles (Requires re-simulation)
    }
    ```
2.  Implement a **"Hypothetical Search"** (The Solver Wrapper):
    * *Logic:* Before submitting a move, the solver must run a simulation: "If I use my 'Double Word' booster on square H7, does my best move score increase by enough points to justify wasting the card?"
    * *Pseudocode:*
        ```rust
        let base_score = solver.find_best_move().score;
        let boosted_board = board.apply_booster(Booster::DoubleWord);
        let boosted_score = solver.solve(&boosted_board).score;

        if (boosted_score - base_score) > BOOSTER_COST_THRESHOLD {
            return (Move, UseBooster::Yes);
        }
        ```

## Phase 4: Time Management (The 60s Constraint)
**Reference Quackle:** `quackle/library/computerplayer.cpp` (Search limits)
**Task:**
1.  Quackle simulates 1000s of games. We cannot do that.
2.  Implement **Iterative Deepening** with a hard time cut-off.
    * *Start:* Depth 1 (Greedy).
    * *Check Clock:* If elapsed < 200ms, go to Depth 2 (2-ply simulation).
    * *Check Clock:* If elapsed > 500ms, **STOP** and return best result immediately.
    * *Safety:* Never let the solver "think" for more than 1.5 seconds, or the websocket connection might lag.

## Final Output
Generate the Rust code for **Phase 3 (The Booster Logic)** first, as that is the biggest structural addition to my existing code.