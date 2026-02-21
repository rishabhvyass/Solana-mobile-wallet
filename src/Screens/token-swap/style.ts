import { StyleSheet } from "react-native";

export const s = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: "#0D0D12",
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 20,
    },
    card: {
        backgroundColor: "#1A1A24",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2A2A35",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tokenSelector: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#252530",
        paddingLeft: 8,
        paddingRight: 12,
        paddingVertical: 8,
        borderRadius: 24,
        gap: 6,
    },
    tokenIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    tokenIconText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    tokenName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    amountInput: {
        fontSize: 40,
        fontWeight: "400",
        color: "#FFFFFF",
        textAlign: "right",
        flex: 1,
        marginLeft: 10,
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
    },
    balanceText: {
        fontSize: 14,
        color: "#666666",
    },
    usdText: {
        fontSize: 14,
        color: "#666666",
    },
    arrowContainer: {
        alignItems: "center",
        marginVertical: -22,
        zIndex: 10,
    },
    swapArrow: {
        backgroundColor: "#0D0D12",
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "#0D0D12",
    },
    swapBtn: {
        backgroundColor: "#14F195",
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 24,
    },
    swapBtnText: {
        color: "#000000",
        fontSize: 18,
        fontWeight: "600",
    },
});