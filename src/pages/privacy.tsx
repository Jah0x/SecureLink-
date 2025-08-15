import Header from '@/react-app/components/Header';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8 text-slate-200">
        <h1 className="text-3xl font-bold mb-6 text-white">Политика конфиденциальности</h1>
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">1. Общие положения</h2>
          <p>TODO: описание политики.</p>
        </section>
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">2. Сбор данных</h2>
          <p>TODO: описание сбора данных.</p>
        </section>
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">3. Использование данных</h2>
          <p>TODO: описание использования данных.</p>
        </section>
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">4. Контакты</h2>
          <p>TODO: контактная информация.</p>
        </section>
      </main>
    </div>
  );
}
