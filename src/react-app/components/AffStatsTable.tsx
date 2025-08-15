interface Stat {
  day: string;
  earnings: number;
}

export default function AffStatsTable({ stats }: { stats: Stat[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-700">
          <th className="p-2 text-left text-slate-300">Дата</th>
          <th className="p-2 text-left text-slate-300">Заработок</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => (
          <tr key={s.day} className="border-b border-slate-700/50">
            <td className="p-2 text-white">{s.day}</td>
            <td className="p-2 text-slate-300">{(s.earnings / 100).toFixed(2)} ₽</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
