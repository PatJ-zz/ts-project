#!/usr/bin/env node

import * as readline from "readline";

interface HandRecord {
    attempts: number;
    cards: string[];
    handType: string;
    bet: number;
}

class DeckSimulator {
    private FANCY: boolean = false;
    private DISCARD_DRAW: boolean = true;
    private interactive: boolean = true;
    private SILENT_MODE: boolean = true;
    private highlow: boolean = true;
    private numWC: number = 10;
    private MAX_ATTEMPTS: number = 5000000;
    private balance: number = 100;
    private currentBet: number = 1;

    private suits: string[] = ["\u2665", "\u2666", "\u2663", "\u2660"];
    private ranks: string[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    private red: string = "\u001B[31m";
    private green: string = "\u001B[32m";
    private reset: string = "\u001B[0m";

    async main(): Promise<void> {
        // Handle Ctrl+C properly
        process.on("SIGINT", () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            console.log("\n\nExiting...");
            process.exit(0);
        });
        
        const deck: string[] = [];
        for (const suit of this.suits) {
            for (const rank of this.ranks) {
                deck.push(rank + suit);
            }
        }
        for (let i = 0; i < this.numWC; i++) {
            deck.push("WC");
        }

        let hand: string[] = [];
        let result: string = "";
        let attempts: number = 0;
        const firstOccurrence: Map<string, HandRecord> = new Map();
        
        const handTypesList: string[] = [
            "High Card", "One Pair", "High Pair", "Two Pair", "Three of a Kind", "Straight",
            "Flush", "Full House", "Four of a Kind", "Straight Flush",
            "Royal Flush"
        ];
        
        if (this.numWC > 0) {
            handTypesList.push("Five of a Kind");
        }
        
        const allHandTypes: Set<string> = new Set(handTypesList);
        const foundHandTypes: Set<string> = new Set();

        if (!this.SILENT_MODE) {
            console.log(`Searching for ${allHandTypes.size} hand types...`);
            console.log(`Deck size: ${deck.length} cards (${this.numWC} wildcards)`);
            console.log(`Starting balance: ${this.balance}`);
            console.log();
        }

        do {
            if (this.interactive) {
                this.currentBet = await this.promptForBet();
            }

            this.shuffleArray(deck);
            hand = [];
            for (let i = 0; i < 5 && i < deck.length; i++) {
                hand.push(deck[i]);
            }
            attempts++;

            if (!this.SILENT_MODE && attempts % 100000 === 0) {
                console.log(`Attempt ${attempts.toLocaleString()}: found ${foundHandTypes.size}/${allHandTypes.size} hand types. Missing: ${this.getMissingHandTypes(allHandTypes, foundHandTypes)}`);
            }

            if (attempts > this.MAX_ATTEMPTS) {
                if (!this.SILENT_MODE) {
                    console.log(`\nReached maximum attempts (${this.MAX_ATTEMPTS}).`);
                    console.log(`Missing hand types: ${this.getMissingHandTypes(allHandTypes, foundHandTypes)}`);
                }
                break;
            }

            const beforeResult = this.evaluatePokerHand(hand);
            
            if (this.DISCARD_DRAW) {
                let toDiscard: number[] = [];
                if (this.interactive) {
                    toDiscard = await this.promptForDiscards(hand, beforeResult, foundHandTypes, allHandTypes);
                } else {
                    toDiscard = this.getAutoDiscardIndices(hand, beforeResult, foundHandTypes, allHandTypes);
                }
                
                if (toDiscard.length > 0) {
                    // Keep track of original discard positions
                    const discardPositions = toDiscard.sort((a, b) => a - b);
                    
                    const drawnCards: string[] = [];
                    let cardsDrawn = 0;
                    let deckIndex = 5;
                    while (cardsDrawn < toDiscard.length && deckIndex < deck.length) {
                        const card = deck[deckIndex];
                        if (card === "WC" || !hand.includes(card)) {
                            drawnCards.push(card);
                            cardsDrawn++;
                        }
                        deckIndex++;
                    }
                    
                    // Remove discarded cards in reverse order so indices don't shift
                    for (let i = discardPositions.length - 1; i >= 0; i--) {
                        hand.splice(discardPositions[i], 1);
                    }
                    
                    // Insert new cards at the original positions
                    for (let i = 0; i < discardPositions.length; i++) {
                        hand.splice(discardPositions[i], 0, drawnCards[i]);
                    }
                    
                    // Update displayed hand in interactive mode
                    if (this.interactive) {
                        console.clear();
                        
                        console.log("\n📋 Your hand:");
                        console.log(`Bet: ${this.currentBet}   Balance: ${this.balance}`);
                        if (this.FANCY) {
                            this.printFancyCards(hand);
                        } else {
                            // Display cards on one line
                            process.stdout.write("  ");
                            for (let i = 0; i < hand.length; i++) {
                                const card = hand[i];
                                const display = this.formatCard(card);
                                process.stdout.write(display);
                                if (i < hand.length - 1) process.stdout.write(" ");
                            }
                            console.log();
                            
                            // Display indices below
                            process.stdout.write("  ");
                            for (let i = 0; i < hand.length; i++) {
                                process.stdout.write(`[${i + 1}]  `);
                            }
                            console.log();
                        }
                        console.log(`\n🃏 Hand type: ${this.evaluatePokerHand(hand)}`);
                    }

                    result = this.evaluatePokerHand(hand);
                    const payout = this.getPayout(result);
                    const winAmount = payout * this.currentBet;

                    if (this.interactive && !(this.highlow && payout > 0)) {
                        await this.waitForKeyPress("Press any key to deal the next hand...");
                    }

                    this.balance -= this.currentBet;
                    this.balance += winAmount;
                    console.log(`\n💰 Hand result: ${winAmount - this.currentBet >= 0 ? `+${winAmount - this.currentBet}` : `${winAmount - this.currentBet}`} (payout: ${payout}x)`);
                    console.log(`💳 Balance: ${this.balance}`);

                    if (this.interactive && this.highlow && payout > 0) {
                        await this.promptForHighLowGamble(winAmount);
                    }
                } else {
                    result = beforeResult;
                }
            }

            if (!firstOccurrence.has(result)) {
                firstOccurrence.set(result, {
                    attempts: attempts,
                    cards: [...hand],
                    handType: result,
                    bet: this.currentBet
                });
                foundHandTypes.add(result);

                if (!this.SILENT_MODE) {
                    console.log(`\n🎯 NEW HAND TYPE at attempt ${attempts.toLocaleString()}: ${result} (${this.getPayout(result)}x)`);
                    if (this.FANCY) {
                        console.log();
                        this.printFancyCards(hand);
                    } else {
                        process.stdout.write("   Cards: ");
                        for (const card of hand) {
                            if (card === "WC") {
                                process.stdout.write(`${this.green}WC${this.reset} `);
                            } else {
                                const isRedCard = card.includes("\u2665") || card.includes("\u2666");
                                const color = isRedCard ? this.red : this.reset;
                                process.stdout.write(`${color}${card}${this.reset} `);
                            }
                        }
                        console.log();
                    }
                    console.log();
                }
            }
        } while (!this.allHandTypesFound(foundHandTypes, allHandTypes) && attempts < this.MAX_ATTEMPTS);

        console.log("\n" + "=".repeat(70));
        console.log("FINAL RESULTS");
        console.log("=".repeat(70));
        
        const sortedRecords = Array.from(firstOccurrence.values()).sort((a, b) => a.attempts - b.attempts);
        
        for (const record of sortedRecords) {
            if (this.FANCY) {
                console.log(`Attempt ${record.attempts.toString().padStart(8)}: ${record.handType.padEnd(20)} (${this.getPayout(record.handType).toString().padStart(3)}x)`);
                this.printFancyCards(record.cards);
                console.log();
            } else {
                process.stdout.write(`Attempt ${record.attempts.toString().padStart(8)}: `);
                for (let i = 0; i < record.cards.length; i++) {
                    const card = record.cards[i];
                    if (card === "WC") {
                        process.stdout.write(`${this.green} WC${this.reset}`);
                    } else {
                        const isRedCard = card.includes("\u2665") || card.includes("\u2666");
                        const color = isRedCard ? this.red : "";
                        const rank = card.substring(0, card.length - 1);
                        const suit = card.charAt(card.length - 1);
                        
                        if (rank === "10") {
                            process.stdout.write(`${color}${rank}${suit}${this.reset}`);
                        } else {
                            process.stdout.write(`${color} ${rank}${suit}${this.reset}`);
                        }
                    }
                    if (i < record.cards.length - 1) {
                        process.stdout.write(" ");
                    }
                }
                console.log(` -> ${record.handType.padEnd(20)} (${this.getPayout(record.handType).toString().padStart(3)}x)`);
            }
        }
        
        if (!this.allHandTypesFound(foundHandTypes, allHandTypes)) {
            console.log("\n" + "=".repeat(70));
            console.log(`⚠️  MISSING HAND TYPES: ${this.getMissingHandTypes(allHandTypes, foundHandTypes)}`);
            console.log("=".repeat(70));
        }
    }

    private allHandTypesFound(found: Set<string>, all: Set<string>): boolean {
        for (const type of all) {
            if (!found.has(type)) return false;
        }
        return true;
    }

    private evaluatePokerHand(hand: string[]): string {
        if (hand.length < 5) {
            return "Not enough cards.";
        }

        let wildCount = 0;
        for (const card of hand) {
            if (card === "WC") wildCount++;
        }

        const valueCounts: Map<number, number> = new Map();
        const suitCounts: Map<string, number> = new Map();
        const valuesList: number[] = [];

        for (const card of hand) {
            if (card === "WC") continue;
            const rank = card.substring(0, card.length - 1);
            const suit = card.charAt(card.length - 1);
            const value = this.rankToValue(rank);
            valuesList.push(value);
            valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
            suitCounts.set(suit, (suitCounts.get(suit) || 0) + 1);
        }

        let pairs = 0;
        let threes = 0;
        for (const count of valueCounts.values()) {
            if (count === 2) pairs++;
            else if (count === 3) threes++;
        }
        
        let maxCount = 0;
        for (const count of valueCounts.values()) {
            if (count > maxCount) maxCount = count;
        }

        let flush = false;
        for (const count of suitCounts.values()) {
            if (count + wildCount >= 5) {
                flush = true;
                break;
            }
        }
        
        const straight = this.isStraightWithWilds(valuesList, wildCount);
        
        let royalFlush = false;
        if (flush && straight) {
            const royalValues = new Set([10, 11, 12, 13, 14]);
            let royalMatches = 0;
            for (const val of valuesList) {
                if (royalValues.has(val)) royalMatches++;
            }
            if (royalMatches + wildCount >= 5) royalFlush = true;
        }
        
        if (royalFlush) return "Royal Flush";
        if (flush && straight) return "Straight Flush";
        if (maxCount + wildCount >= 5) return "Five of a Kind";
        if (maxCount + wildCount >= 4) return "Four of a Kind";
        
        if (threes === 1 && pairs >= 1) return "Full House";
        if (threes === 1 && wildCount >= 1) return "Full House";
        if (pairs >= 2 && wildCount >= 1) return "Full House";
        if (pairs === 1 && wildCount >= 2) return "Full House";
        if (maxCount === 2 && wildCount >= 3) return "Full House";
        
        if (flush) return "Flush";
        if (straight) return "Straight";
        
        if (threes === 1) return "Three of a Kind";
        if (pairs === 1 && wildCount >= 1) return "Three of a Kind";
        if (wildCount >= 2) return "Three of a Kind";
        
        if (pairs >= 2) return "Two Pair";
        if (pairs === 1 && wildCount >= 1) return "Two Pair";
        
        if (this.isHighPair(valueCounts, wildCount)) return "High Pair";
        
        if (pairs === 1) return "One Pair";
        if (wildCount >= 1) return "One Pair";
        
        return "High Card";
    }

    private isHighPair(valueCounts: Map<number, number>, wildCount: number): boolean {
        if (wildCount >= 2) {
            return true;
        }

        for (const [value, count] of valueCounts) {
            if (value >= 11 && count + wildCount >= 2) {
                return true;
            }
        }

        return false;
    }

    private rankToValue(rank: string): number {
        switch (rank) {
            case "A": return 14;
            case "K": return 13;
            case "Q": return 12;
            case "J": return 11;
            default: return parseInt(rank);
        }
    }

    private isStraightWithWilds(values: number[], wildCount: number): boolean {
        if (values.length + wildCount < 5) return false;
        if (wildCount >= 4) return true;
        
        const uniqueValues = new Set(values);
        if (uniqueValues.has(14)) {
            uniqueValues.add(1);
        }
        
        const sorted = Array.from(uniqueValues).sort((a, b) => a - b);
        
        for (let start = 1; start <= 10; start++) {
            let consecutiveCards = 0;
            let usedWilds = 0;
            
            for (let offset = 0; offset < 5; offset++) {
                const target = start + offset;
                if (sorted.includes(target)) {
                    consecutiveCards++;
                } else {
                    usedWilds++;
                }
            }
            
            if (consecutiveCards + usedWilds >= 5 && usedWilds <= wildCount) {
                return true;
            }
        }
        
        return false;
    }

    private getPayout(handType: string): number {
        switch (handType) {
            case "Royal Flush": return 800;
            case "Straight Flush": return 50;
            case "Five of a Kind": return 1000;
            case "Four of a Kind": return 25;
            case "Full House": return 10;
            case "Flush": return 8;
            case "Straight": return 5;
            case "Three of a Kind": return 3;
            case "Two Pair": return 2;
            case "High Pair": return 1;
            case "One Pair": return 0;
            default: return 0;
        }
    }

    private getMissingHandTypes(allHandTypes: Set<string>, foundHandTypes: Set<string>): string {
        const missing: string[] = [];
        for (const type of allHandTypes) {
            if (!foundHandTypes.has(type)) {
                missing.push(type);
            }
        }
        return missing.join(", ");
    }


private printFancyCards(cards: string[]): void {
    if (cards.length === 0) return;
    
    // Top border
    for (let i = 0; i < cards.length; i++) {
        process.stdout.write("┌───┐");
        if (i < cards.length - 1) process.stdout.write(" ");
    }
    console.log();
    
    // Rank row - each card content MUST be exactly 3 characters
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        process.stdout.write("│");
        if (card === "WC") {
            // " W " with space on both sides = 3 chars
            process.stdout.write(`${this.green} W ${this.reset}`);
        } else {
            const isRedCard = card.includes("\u2665") || card.includes("\u2666");
            const color = isRedCard ? this.red : "";
            const rank = card.substring(0, card.length - 1);
            if (rank === "10") {
                // "10" plus space = 3 chars: "10 "
                process.stdout.write(`${color}10 ${this.reset}`);
            } else {
                // Single char rank: space + rank + space = " J "
                process.stdout.write(`${color} ${rank} ${this.reset}`);
            }
        }
        process.stdout.write("│");
        if (i < cards.length - 1) process.stdout.write(" ");
    }
    console.log();
    
    // Suit row - each card content MUST be exactly 3 characters
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        process.stdout.write("│");
        if (card === "WC") {
            // " C " with space on both sides = 3 chars
            process.stdout.write(`${this.green} C ${this.reset}`);
        } else {
            const isRedCard = card.includes("\u2665") || card.includes("\u2666");
            const color = isRedCard ? this.red : "";
            const suit = card.charAt(card.length - 1);
            // Space + suit + space = " ♥ "
            process.stdout.write(`${color} ${suit} ${this.reset}`);
        }
        process.stdout.write("│");
        if (i < cards.length - 1) process.stdout.write(" ");
    }
    console.log();
    
    // Bottom border
    for (let i = 0; i < cards.length; i++) {
        process.stdout.write("└───┘");
        if (i < cards.length - 1) process.stdout.write(" ");
    }
    console.log();
}



    private getAutoDiscardIndices(hand: string[], currentHandType: string, foundHandTypes: Set<string>, allHandTypes: Set<string>): number[] {
        const toDiscard: number[] = [];
        
        if (!foundHandTypes.has(currentHandType)) {
            return toDiscard;
        }
        
        for (let i = 0; i < hand.length && toDiscard.length < 3; i++) {
            const card = hand[i];
            if (card !== "WC") {
                const rank = card.substring(0, card.length - 1);
                const value = this.getRankValue(rank);
                if (value < 10) {
                    toDiscard.push(i);
                }
            }
        }
        
        return toDiscard;
    }

    private getAutoHoldIndices(hand: string[], currentHandType: string): Set<number> {
        const held: Set<number> = new Set();
        if (currentHandType === "High Card") {
            let highestValue = -1;
            for (const card of hand) {
                if (card === "WC") continue;
                const rank = card.substring(0, card.length - 1);
                const value = this.getRankValue(rank);
                if (value > highestValue) {
                    highestValue = value;
                }
            }
            for (let i = 0; i < hand.length; i++) {
                const card = hand[i];
                if (card === "WC") continue;
                const rank = card.substring(0, card.length - 1);
                if (this.getRankValue(rank) === highestValue) {
                    held.add(i);
                }
            }
            return held;
        }

        const holdAll = ["Straight", "Flush", "Straight Flush", "Royal Flush", "Full House", "Five of a Kind"];

        const rankCounts: Map<string, number> = new Map();
        const wildIndices: number[] = [];
        for (let i = 0; i < hand.length; i++) {
            const card = hand[i];
            if (card === "WC") {
                wildIndices.push(i);
                continue;
            }
            const rank = card.substring(0, card.length - 1);
            rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
        }

        if (currentHandType === "Four of a Kind") {
            const targetRank = Array.from(rankCounts.entries())
                .find(([, count]) => count + wildIndices.length >= 4);
            if (targetRank) {
                const rank = targetRank[0];
                for (const idx of wildIndices) {
                    held.add(idx);
                }
                for (let i = 0; i < hand.length; i++) {
                    const card = hand[i];
                    if (card !== "WC" && card.substring(0, card.length - 1) === rank) {
                        held.add(i);
                    }
                }
                return held;
            }
        }

        if (holdAll.includes(currentHandType)) {
            for (let i = 0; i < hand.length; i++) {
                held.add(i);
            }
            return held;
        }

        const pairRanks = Array.from(rankCounts.entries())
            .filter(([, count]) => count >= 2)
            .map(([rank]) => rank);

        if (currentHandType === "One Pair") {
            if (wildIndices.length > 0) {
                for (const idx of wildIndices) {
                    held.add(idx);
                }
                return held;
            }
            if (pairRanks.length > 0) {
                for (let i = 0; i < hand.length; i++) {
                    const card = hand[i];
                    if (pairRanks.includes(card.substring(0, card.length - 1))) {
                        held.add(i);
                    }
                }
            }
            return held;
        }

        if (currentHandType === "High Pair") {
            if (wildIndices.length > 0 && rankCounts.size > 0) {
                const highRankCards = Array.from(rankCounts.keys())
                    .filter((rank) => this.getRankValue(rank) >= 11)
                    .sort((a, b) => this.getRankValue(b) - this.getRankValue(a));
                if (highRankCards.length > 0) {
                    const highestRank = highRankCards[0];
                    for (const idx of wildIndices) {
                        held.add(idx);
                    }
                    let oneHeld = false;
                    for (let i = 0; i < hand.length && !oneHeld; i++) {
                        const card = hand[i];
                        if (card !== "WC" && card.substring(0, card.length - 1) === highestRank) {
                            held.add(i);
                            oneHeld = true;
                        }
                    }
                    return held;
                }
            }

            const highPairRanks = pairRanks.filter((rank) => this.getRankValue(rank) >= 11);
            if (highPairRanks.length > 0) {
                for (let i = 0; i < hand.length; i++) {
                    const card = hand[i];
                    if (card === "WC" || highPairRanks.includes(card.substring(0, card.length - 1))) {
                        held.add(i);
                    }
                }
            }
            return held;
        }

        if (currentHandType === "Two Pair") {
            for (let i = 0; i < hand.length; i++) {
                const card = hand[i];
                if (card === "WC" || pairRanks.includes(card.substring(0, card.length - 1))) {
                    held.add(i);
                }
            }
            return held;
        }

        if (currentHandType === "Three of a Kind") {
            const tripleRank = Array.from(rankCounts.entries()).find(([, count]) => count >= 3);
            if (tripleRank) {
                const rank = tripleRank[0];
                for (let i = 0; i < hand.length; i++) {
                    const card = hand[i];
                    if (card === "WC" || card.substring(0, card.length - 1) === rank) {
                        held.add(i);
                    }
                }
                return held;
            }

            const pairRank = Array.from(rankCounts.entries()).find(([, count]) => count === 2);
            if (pairRank && wildIndices.length > 0) {
                const rank = pairRank[0];
                for (let i = 0; i < hand.length; i++) {
                    const card = hand[i];
                    if (card === "WC" || card.substring(0, card.length - 1) === rank) {
                        held.add(i);
                    }
                }
                return held;
            }

            if (wildIndices.length >= 2) {
                for (const idx of wildIndices) {
                    held.add(idx);
                }
                return held;
            }

            return held;
        }

        return held;
    }
    
    private getRankValue(rank: string): number {
        switch (rank) {
            case "A": return 14;
            case "K": return 13;
            case "Q": return 12;
            case "J": return 11;
            case "10": return 10;
            default: return parseInt(rank);
        }
    }

    private formatCard(card: string): string {
        if (card === "WC") {
            return `${this.green} WC ${this.reset}`;
        }

        const isRedCard = card.includes("\u2665") || card.includes("\u2666");
        const color = isRedCard ? this.red : this.reset;
        const rank = card.substring(0, card.length - 1);
        const suit = card.charAt(card.length - 1);

        if (rank === "10") {
            return `${color}10${suit} ${this.reset}`;
        }

        return `${color} ${rank}${suit} ${this.reset}`;
    }

    private async promptForDiscards(hand: string[], currentHandType: string, foundHandTypes: Set<string>, allHandTypes: Set<string>): Promise<number[]> {
        const held: Set<number> = this.getAutoHoldIndices(hand, currentHandType);
        
        return new Promise((resolve) => {
            // Set stdin to raw mode to capture individual key presses
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            
            const displayHand = () => {
                console.clear();
                console.log("\n📋 Your hand:");
                console.log(`Bet: ${this.currentBet}   Balance: ${this.balance}`);
                
                if (this.FANCY) {
                    this.printFancyCards(hand);

                    // Align card labels with fancy cards, one card box equals 5 columns plus one separator.
                    for (let i = 0; i < hand.length; i++) {
                        const status = held.has(i) ? "✓" : (i + 1).toString();
                        const padded = status.length === 1 ? `  ${status}  ` : ` ${status}  `;
                        process.stdout.write(padded);
                        if (i < hand.length - 1) process.stdout.write(" ");
                    }
                    console.log();
                } else {
                    // First line: cards
                    process.stdout.write("  ");
                    for (let i = 0; i < hand.length; i++) {
                        const card = hand[i];
                        const display = this.formatCard(card);
                        process.stdout.write(display);
                        if (i < hand.length - 1) process.stdout.write(" ");
                    }
                    console.log();
                    
                    // Second line: card numbers and held status
                    process.stdout.write("  ");
                    for (let i = 0; i < hand.length; i++) {
                        const status = held.has(i) ? "✓" : i + 1;
                        process.stdout.write(`[${status}]  `);
                    }
                    console.log();
                }
                console.log(`\n🃏 Hand type: ${this.evaluatePokerHand(hand)}`);
                console.log("🎮 Press 1-5 to toggle hold, Enter to confirm, 'q' to quit:");
            };
            
            displayHand();
            
            const onData = (char: any) => {
                const charStr = char.toString().toLowerCase();
                
                // Handle 'q' to quit
                if (charStr === "q") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    console.log("\nExiting...");
                    process.exit(0);
                }
                
                const code = charStr.charCodeAt(0);
                
                // Handle Enter (code 13) to confirm
                if (code === 13) {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    
                    // Calculate which cards to discard
                    const toDiscard: number[] = [];
                    for (let i = 0; i < hand.length; i++) {
                        if (!held.has(i)) {
                            toDiscard.push(i);
                        }
                    }
                    resolve(toDiscard);
                    return;
                }
                
                // Handle numbers 1-5
                const num = parseInt(charStr);
                if (num >= 1 && num <= 5 && num <= hand.length) {
                    const cardIndex = num - 1;
                    if (held.has(cardIndex)) {
                        held.delete(cardIndex);
                    } else {
                        held.add(cardIndex);
                    }
                    displayHand();
                }
            };
            
            process.stdin.on("data", onData);
        });
    }

    private waitForKeyPress(message: string = "Press any key to continue..."): Promise<void> {
        return new Promise((resolve) => {
            console.log();
            console.log(message);
            console.log("(Press 'q' to quit)");
            
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            
            const onData = (char: any) => {
                const charStr = char.toString().toLowerCase();
                if (charStr === "q") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    console.log("\nExiting...");
                    process.exit(0);
                }
                process.stdin.removeListener("data", onData);
                process.stdin.setRawMode(false);
                process.stdin.pause();
                resolve();
            };
            
            process.stdin.on("data", onData);
        });
    }

    private async promptForHighLowGamble(stake: number): Promise<void> {
        let currentStake = stake;
        let currentCard = this.getRandomHighLowCard();
        const cardSeq: string[] = [currentCard];
        let printedCardLine = false;

        while (currentStake > 0) {
            if (!printedCardLine) {
                console.log(`\n🂠 Cards: ${cardSeq.map(c => this.formatCard(c)).join('')}`);
                printedCardLine = true;
            }
            console.log(`🎮 Press ↑ for high, ↓ for low, or Space to stand.`);
            console.log(`🎲 Wager: ${currentStake} (press Space to keep the current winnings)`);

            const guess = await this.promptHighLowDecision();
            if (guess === "s") {
                console.log(`\n🛑 Standing on current winnings.`);
                return;
            }

            const currentRank = this.rankToValue(currentCard.substring(0, currentCard.length - 1));
            const nextCard = this.getRandomHighLowCard();
            const nextRank = this.rankToValue(nextCard.substring(0, nextCard.length - 1));
            cardSeq.push(nextCard);

            const won = this.isHighLowGuessCorrect(currentRank, nextRank, guess);
            if (!won) {
                this.balance -= currentStake;
                console.log(`\n❌ Wrong. You lost ${currentStake}.`);
                console.log(`💳 Balance: ${this.balance}`);
                return;
            }

            this.balance += currentStake;
            currentStake *= 2;
            console.log(`\n🂠 Cards: ${cardSeq.map(c => this.formatCard(c)).join('')}`);
            console.log(`\n✅ Correct! Your gamble doubled to ${currentStake}.`);
            console.log(`💳 Balance: ${this.balance}`);

            currentCard = nextCard;
            printedCardLine = false;
        }
    }

    private async promptYesNo(question: string): Promise<boolean> {
        process.stdin.setRawMode(false);
        process.stdin.resume();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                const normalized = answer.trim().toLowerCase();
                resolve(normalized === "y" || normalized === "yes");
            });
        });
    }

    private async promptHighLowDecision(): Promise<"h" | "l" | "s"> {
        return new Promise((resolve) => {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding("utf8");

            const onData = (char: any) => {
                const input = char.toString();
                if (input === "\u0003" || input.toLowerCase() === "q") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    console.log("\nExiting...");
                    process.exit(0);
                }

                if (input === " ") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    resolve("s");
                    return;
                }

                if (input.includes("[A")) {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    resolve("h");
                    return;
                }

                if (input.includes("[B")) {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    resolve("l");
                    return;
                }

                const normalized = input.trim().toLowerCase();
                if (normalized === "h" || normalized === "l" || normalized === "s") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    resolve(normalized as "h" | "l" | "s");
                }
            };

            process.stdin.on("data", onData);
        });
    }

    private getRandomHighLowCard(): string {
        const rank = this.ranks[Math.floor(Math.random() * this.ranks.length)];
        const suit = this.suits[Math.floor(Math.random() * this.suits.length)];
        return `${rank}${suit}`;
    }

    private valueToRank(value: number): string {
        switch (value) {
            case 14: return "A";
            case 13: return "K";
            case 12: return "Q";
            case 11: return "J";
            default: return value.toString();
        }
    }

    private isHighLowGuessCorrect(currentRank: number, nextRank: number, guess: "h" | "l"): boolean {
        const currentVariants = currentRank === 14 ? [1, 14] : [currentRank];
        const nextVariants = nextRank === 14 ? [1, 14] : [nextRank];
        let possibleWin = false;

        for (const currentVariant of currentVariants) {
            for (const nextVariant of nextVariants) {
                if (nextVariant === currentVariant) {
                    continue;
                }
                if (guess === "h" && nextVariant > currentVariant) {
                    possibleWin = true;
                }
                if (guess === "l" && nextVariant < currentVariant) {
                    possibleWin = true;
                }
            }
        }

        return possibleWin;
    }

    private async promptForBet(): Promise<number> {
        if (this.balance <= 0) {
            console.log("Balance is zero. No more bets can be placed.");
            process.exit(0);
        }

        process.stdin.setRawMode(false);
        process.stdin.resume();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            const defaultBet = Math.min(this.currentBet, this.balance);
            const ask = () => {
                rl.question(`Enter bet amount (1-${this.balance}, default ${defaultBet}): `, (answer) => {
                    const trimmed = answer.trim();
                    if (trimmed === "") {
                        rl.close();
                        resolve(defaultBet);
                        return;
                    }

                    const bet = parseInt(trimmed, 10);
                    if (Number.isInteger(bet) && bet > 0 && bet <= this.balance) {
                        rl.close();
                        resolve(bet);
                    } else {
                        console.log(`Invalid bet. Please enter a positive integer up to ${this.balance}.`);
                        ask();
                    }
                });
            };

            ask();
        });
    }

    private shuffleArray<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Run the simulation
const simulator = new DeckSimulator();
simulator.main().catch(console.error);
