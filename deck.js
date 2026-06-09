#!/usr/bin/env node
"use strict";
class DeckSimulator {
    FANCY = false;
    DISCARD_DRAW = false;
    interactive = false;
    SILENT_MODE = true;
    numWC = 52;
    MAX_ATTEMPTS = 5000000;
    suits = ["\u2665", "\u2666", "\u2663", "\u2660"];
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    red = "\u001B[31m";
    green = "\u001B[32m";
    reset = "\u001B[0m";
    async main() {
        const deck = [];
        for (const suit of this.suits) {
            for (const rank of this.ranks) {
                deck.push(rank + suit);
            }
        }
        for (let i = 0; i < this.numWC; i++) {
            deck.push("WC");
        }
        let hand = [];
        let result = "";
        let attempts = 0;
        const firstOccurrence = new Map();
        const handTypesList = [
            "High Card", "One Pair", "Two Pair", "Three of a Kind", "Straight",
            "Flush", "Full House", "Four of a Kind", "Straight Flush",
            "Royal Flush"
        ];
        if (this.numWC > 0) {
            handTypesList.push("Five of a Kind");
        }
        const allHandTypes = new Set(handTypesList);
        const foundHandTypes = new Set();
        if (!this.SILENT_MODE) {
            console.log(`Searching for ${allHandTypes.size} hand types...`);
            console.log(`Deck size: ${deck.length} cards (${this.numWC} wildcards)`);
            console.log();
        }
        do {
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
                const toDiscard = this.getAutoDiscardIndices(hand, beforeResult, foundHandTypes, allHandTypes);
                if (toDiscard.length > 0) {
                    toDiscard.sort((a, b) => b - a);
                    for (const idx of toDiscard) {
                        hand.splice(idx, 1);
                    }
                    let cardsDrawn = 0;
                    let deckIndex = 5;
                    while (cardsDrawn < toDiscard.length && deckIndex < deck.length) {
                        const card = deck[deckIndex];
                        if (card === "WC" || !hand.includes(card)) {
                            hand.push(card);
                            cardsDrawn++;
                        }
                        deckIndex++;
                    }
                }
                result = this.evaluatePokerHand(hand);
            }
            else {
                result = beforeResult;
            }
            if (!firstOccurrence.has(result)) {
                firstOccurrence.set(result, {
                    attempts: attempts,
                    cards: [...hand],
                    handType: result
                });
                foundHandTypes.add(result);
                if (!this.SILENT_MODE) {
                    console.log(`\n🎯 NEW HAND TYPE at attempt ${attempts.toLocaleString()}: ${result} (${this.getPayout(result)}x)`);
                    if (this.FANCY) {
                        console.log();
                        this.printFancyCards(hand);
                    }
                    else {
                        process.stdout.write("   Cards: ");
                        for (const card of hand) {
                            if (card === "WC") {
                                process.stdout.write(`${this.green}WC${this.reset} `);
                            }
                            else {
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
            }
            else {
                process.stdout.write(`Attempt ${record.attempts.toString().padStart(8)}: `);
                for (let i = 0; i < record.cards.length; i++) {
                    const card = record.cards[i];
                    if (card === "WC") {
                        process.stdout.write(`${this.green} WC${this.reset}`);
                    }
                    else {
                        const isRedCard = card.includes("\u2665") || card.includes("\u2666");
                        const color = isRedCard ? this.red : "";
                        const rank = card.substring(0, card.length - 1);
                        const suit = card.charAt(card.length - 1);
                        if (rank === "10") {
                            process.stdout.write(`${color}${rank}${suit}${this.reset}`);
                        }
                        else {
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
    allHandTypesFound(found, all) {
        for (const type of all) {
            if (!found.has(type))
                return false;
        }
        return true;
    }
    evaluatePokerHand(hand) {
        if (hand.length < 5) {
            return "Not enough cards.";
        }
        let wildCount = 0;
        for (const card of hand) {
            if (card === "WC")
                wildCount++;
        }
        const valueCounts = new Map();
        const suitCounts = new Map();
        const valuesList = [];
        for (const card of hand) {
            if (card === "WC")
                continue;
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
            if (count === 2)
                pairs++;
            else if (count === 3)
                threes++;
        }
        let maxCount = 0;
        for (const count of valueCounts.values()) {
            if (count > maxCount)
                maxCount = count;
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
                if (royalValues.has(val))
                    royalMatches++;
            }
            if (royalMatches + wildCount >= 5)
                royalFlush = true;
        }
        if (royalFlush)
            return "Royal Flush";
        if (flush && straight)
            return "Straight Flush";
        if (maxCount + wildCount >= 5)
            return "Five of a Kind";
        if (maxCount + wildCount >= 4)
            return "Four of a Kind";
        if (threes === 1 && pairs >= 1)
            return "Full House";
        if (threes === 1 && wildCount >= 1)
            return "Full House";
        if (pairs >= 2 && wildCount >= 1)
            return "Full House";
        if (pairs === 1 && wildCount >= 2)
            return "Full House";
        if (maxCount === 2 && wildCount >= 3)
            return "Full House";
        if (flush)
            return "Flush";
        if (straight)
            return "Straight";
        if (threes === 1)
            return "Three of a Kind";
        if (pairs === 1 && wildCount >= 1)
            return "Three of a Kind";
        if (wildCount >= 2)
            return "Three of a Kind";
        if (pairs >= 2)
            return "Two Pair";
        if (pairs === 1 && wildCount >= 1)
            return "Two Pair";
        if (pairs === 1)
            return "One Pair";
        if (wildCount >= 1)
            return "One Pair";
        return "High Card";
    }
    rankToValue(rank) {
        switch (rank) {
            case "A": return 14;
            case "K": return 13;
            case "Q": return 12;
            case "J": return 11;
            default: return parseInt(rank);
        }
    }
    isStraightWithWilds(values, wildCount) {
        if (values.length + wildCount < 5)
            return false;
        if (wildCount >= 4)
            return true;
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
                }
                else {
                    usedWilds++;
                }
            }
            if (consecutiveCards + usedWilds >= 5 && usedWilds <= wildCount) {
                return true;
            }
        }
        return false;
    }
    getPayout(handType) {
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
            case "One Pair": return 1;
            default: return 0;
        }
    }
    getMissingHandTypes(allHandTypes, foundHandTypes) {
        const missing = [];
        for (const type of allHandTypes) {
            if (!foundHandTypes.has(type)) {
                missing.push(type);
            }
        }
        return missing.join(", ");
    }
    printFancyCards(cards) {
        if (cards.length === 0)
            return;
        for (let i = 0; i < cards.length; i++) {
            process.stdout.write("┌───┐");
            if (i < cards.length - 1)
                process.stdout.write(" ");
        }
        console.log();
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            process.stdout.write("│");
            if (card === "WC") {
                process.stdout.write(`${this.green} W ${this.reset}`);
            }
            else {
                const isRedCard = card.includes("\u2665") || card.includes("\u2666");
                const color = isRedCard ? this.red : "";
                const rank = card.substring(0, card.length - 1);
                if (rank === "10") {
                    process.stdout.write(`${color}10${this.reset}`);
                }
                else {
                    process.stdout.write(`${color} ${rank}${this.reset}`);
                }
            }
            process.stdout.write("│");
            if (i < cards.length - 1)
                process.stdout.write(" ");
        }
        console.log();
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            process.stdout.write("│");
            if (card === "WC") {
                process.stdout.write(`${this.green} C ${this.reset}`);
            }
            else {
                const isRedCard = card.includes("\u2665") || card.includes("\u2666");
                const color = isRedCard ? this.red : "";
                const suit = card.charAt(card.length - 1);
                process.stdout.write(`${color} ${suit}${this.reset}`);
            }
            process.stdout.write("│");
            if (i < cards.length - 1)
                process.stdout.write(" ");
        }
        console.log();
        for (let i = 0; i < cards.length; i++) {
            process.stdout.write("└───┘");
            if (i < cards.length - 1)
                process.stdout.write(" ");
        }
        console.log();
    }
    getAutoDiscardIndices(hand, currentHandType, foundHandTypes, allHandTypes) {
        const toDiscard = [];
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
    getRankValue(rank) {
        switch (rank) {
            case "A": return 14;
            case "K": return 13;
            case "Q": return 12;
            case "J": return 11;
            case "10": return 10;
            default: return parseInt(rank);
        }
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
// Run the simulation
const simulator = new DeckSimulator();
simulator.main().catch(console.error);
