import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "./style"

export  function SwapScreen() {
    const [fromAmount, setFromAmount] = useState("100");
    const [toAmount, setToAmount] = useState("0.28014");
    const [fromToken, setFromToken] = useState("USDC");
    const [toToken, setToToken] = useState("SOL");

    const swapTokens = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount(toAmount);
        setToAmount(fromAmount);
    };

    const handleSwap = () => {
        if (!fromAmount) return Alert.alert("Enter an amount");
        Alert.alert(
            "Swap",
            `Swapping ${fromAmount} ${fromToken} to ${toAmount} ${toToken}`,
        );
    };

    return (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            <Text style={s.title}>Swap Tokens</Text>

            {/* From Token Card */}
            <View style={[s.card, { marginBottom: 10 }]}>
                <View style={s.cardHeader}>
                    <TouchableOpacity style={s.tokenSelector}>
                        <View style={[s.tokenIcon, { backgroundColor: "#9945FF" }]}>
                            <Text style={s.tokenIconText}>S</Text>
                        </View>
                        <Text style={s.tokenName}>{fromToken}</Text>
                        <Ionicons name="chevron-down" size={18} color="#888" />
                    </TouchableOpacity>
                    <TextInput
                        style={s.amountInput}
                        value={fromAmount}
                        onChangeText={setFromAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#666"
                    />
                </View>
                <View style={s.cardFooter}>
                    <Text style={s.balanceText}>Balance: 0.0661 {fromToken}</Text>
                    <Text style={s.usdText}>$499.749</Text>
                </View>
            </View>

            {/* Swap Arrow */}
            <View style={s.arrowContainer}>
                <TouchableOpacity style={s.swapArrow} onPress={swapTokens}>
                    <Ionicons name="arrow-down" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* To Token Card */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <TouchableOpacity style={s.tokenSelector}>
                        <View style={[s.tokenIcon, { backgroundColor: "#2775CA" }]}>
                            <Text style={s.tokenIconText}>$</Text>
                        </View>
                        <Text style={s.tokenName}>{toToken}</Text>
                        <Ionicons name="chevron-down" size={18} color="#888" />
                    </TouchableOpacity>
                    <TextInput
                        style={s.amountInput}
                        value={toAmount}
                        onChangeText={setToAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#666"
                    />
                </View>
                <View style={s.cardFooter}>
                    <Text style={s.balanceText}>Balance: 250 {toToken}</Text>
                    <Text style={s.usdText}>$499.419</Text>
                </View>
            </View>

            {/* Swap Button */}
            <TouchableOpacity style={s.swapBtn} onPress={handleSwap}>
                <Text style={s.swapBtnText}>Swap</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

