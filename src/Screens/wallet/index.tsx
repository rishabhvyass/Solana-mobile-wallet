import { useState } from "react";
import { s } from './style';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from "react-native";
import { getBalance, getTokens, getTxns, short, timeAgo } from "../../utils/helpers";

export  function Wallet() {

    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [tokens, setTokens] = useState<any[]>([]);
    const [txns, setTxns] = useState<any[]>([]);

    const search = async () => {
        const addr = address.trim();
        if (!addr) return Alert.alert("Enter a wallet address");

        setLoading(true);
        try {
            const [bal, tok, tx] = await Promise.all([
                getBalance(addr),
                getTokens(addr),
                getTxns(addr),
            ]);
            setBalance(bal);
            setTokens(tok);
            setTxns(tx);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
        setLoading(false);
    };

    const tryExample = () => {
        setAddress("GFxJzwDSAKbWq9hJWRXLsJAhpab4emLRwtexV2Krfew1");
    };

    return (
        // <SafeAreaView style={s.safe}>
        <ScrollView style={s.scroll}>

            <Text style={s.title}> Solscan </Text>
            <Text style={s.subtitle}>Explore any Solana Wallet</Text>
            <View style={s.inputContainer}>
                <TextInput
                    style={s.input}
                    placeholder="Solana wallet address..."
                    placeholderTextColor="#555"
                    value={address}
                    onChangeText={setAddress}
                    autoCapitalize="none"
                    autoCorrect={false}
                />


            </View>
            <View style={s.btnRow}>

                <TouchableOpacity style={s.btn} onPress={search} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={s.btnText}>Search</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={s.btnGhost} onPress={tryExample}>
                    <Text style={s.btnGhostText}>Demo</Text>
                </TouchableOpacity>

            </View>

            {balance !== null && (
                <View style={s.card}>
                    <Text style={s.label}>SOL Balance</Text>
                    <View style={s.balanceRow}>
                        <Text style={s.balance}>{balance.toFixed(4)}</Text>
                        <Text style={s.sol}>SOL</Text>
                    </View>
                    <Text style={s.addr}>{short(address.trim(), 6)}</Text>
                </View>
            )}

            {tokens.length > 0 && (
                <>
                    <Text style={s.section}>Tokens ({tokens.length})</Text>
                    <FlatList
                        data={tokens}
                        keyExtractor={(t) => t.mint}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                            <View style={s.row}>
                                <Text style={s.mint}>{short(item.mint, 6)}</Text>
                                <Text style={s.amount}>{item.amount}</Text>
                            </View>
                        )}
                    />
                </>
            )}

            {txns.length > 0 && (
                <>
                    <Text style={s.section}>Recent Transactions</Text>
                    <FlatList
                        data={txns}
                        keyExtractor={(t) => t.sig}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={s.row}
                                onPress={() =>
                                    Linking.openURL(`https://solscan.io/tx/${item.sig}`)
                                }
                            >
                                <View>
                                    <Text style={s.mint}>{short(item.sig, 8)}</Text>
                                    <Text style={s.time}>
                                        {item.time ? timeAgo(item.time) : "pending"}
                                    </Text>
                                </View>
                                <Text style={{ color: item.ok ? "#14F195" : "#EF4444", fontSize: 18 }}>
                                    {item.ok ? "+" : "-"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
        // </SafeAreaView>

    );
}
