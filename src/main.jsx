import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const RootApplication = window.location.pathname.startsWith("/deneme-dashboard")
  ? React.lazy(() => import("./deneme-dashboard/DenemeDashboard.jsx"))
  : App;

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Uygulama render hatası", error, info);
  }

  clearLocalSession = () => {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("tugay-santiye"))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      console.warn("Yerel kayıt temizlenemedi", error);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash-screen">
        <section className="crash-panel">
          <h1>Uygulama yüklenemedi</h1>
          <p>
            Tarayıcıda kayıtlı eski veya bozuk veri ekranı durdurdu. Oturumu temizleyip yeniden yükleyerek
            uygulamayı açabilirsin.
          </p>
          <button className="primary-action" type="button" onClick={this.clearLocalSession}>
            Oturumu temizle ve yeniden yükle
          </button>
          <details>
            <summary>Hata detayı</summary>
            <pre>{this.state.error?.message || String(this.state.error)}</pre>
          </details>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <React.Suspense fallback={<main className="crash-screen" aria-label="Deneme ortamı yükleniyor" />}>
        <RootApplication />
      </React.Suspense>
    </RootErrorBoundary>
  </React.StrictMode>,
);
