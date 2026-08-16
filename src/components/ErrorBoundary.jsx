import React from "react";

/**
 * ErrorBoundary — Catches fatal React rendering errors and displays
 * a full-screen error overlay with the stack trace instead of a blank screen.
 *
 * Wraps the entire app in App.jsx. Any uncaught error in a child component's
 * render(), lifecycle method, or constructor will be caught here.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("[ErrorBoundary] Caught fatal error:", error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 99999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2rem",
                        background: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(12px)",
                        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                    }}
                >
                    <div
                        style={{
                            maxWidth: "640px",
                            width: "100%",
                            background: "rgba(255,255,255,0.95)",
                            borderRadius: "24px",
                            boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
                            overflow: "hidden",
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                background: "linear-gradient(135deg, #DC2626, #991B1B)",
                                padding: "24px 28px",
                                display: "flex",
                                alignItems: "center",
                                gap: "14px",
                            }}
                        >
                            <div
                                style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "12px",
                                    background: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "22px",
                                    flexShrink: 0,
                                }}
                            >
                                💥
                            </div>
                            <div>
                                <p
                                    style={{
                                        color: "rgba(255,255,255,0.7)",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                        margin: 0,
                                    }}
                                >
                                    Runtime Error
                                </p>
                                <h2
                                    style={{
                                        color: "#fff",
                                        fontSize: "18px",
                                        fontWeight: 800,
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Something went wrong
                                </h2>
                            </div>
                        </div>

                        {/* Error Details */}
                        <div style={{ padding: "24px 28px" }}>
                            <p
                                style={{
                                    color: "#DC2626",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    marginBottom: "12px",
                                    wordBreak: "break-word",
                                }}
                            >
                                {this.state.error?.toString() || "Unknown error"}
                            </p>

                            {this.state.errorInfo?.componentStack && (
                                <div
                                    style={{
                                        background: "#1E1E1E",
                                        borderRadius: "12px",
                                        padding: "16px",
                                        maxHeight: "220px",
                                        overflowY: "auto",
                                        marginBottom: "20px",
                                    }}
                                >
                                    <pre
                                        style={{
                                            color: "#E5E7EB",
                                            fontSize: "11px",
                                            fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                                            lineHeight: 1.6,
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}

                            <button
                                onClick={this.handleReload}
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                                    color: "#fff",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    border: "none",
                                    borderRadius: "14px",
                                    cursor: "pointer",
                                    boxShadow: "0 8px 24px rgba(220,38,38,0.3)",
                                    transition: "transform 0.15s, box-shadow 0.15s",
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 12px 32px rgba(220,38,38,0.4)";
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(220,38,38,0.3)";
                                }}
                            >
                                🔄 Reload Application
                            </button>

                            <p
                                style={{
                                    color: "#9CA3AF",
                                    fontSize: "11px",
                                    textAlign: "center",
                                    marginTop: "14px",
                                    lineHeight: 1.5,
                                }}
                            >
                                If this keeps happening, please screenshot this error and report it.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
