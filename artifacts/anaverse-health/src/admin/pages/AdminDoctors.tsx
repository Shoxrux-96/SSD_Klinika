import { Edit, Plus, Trash2 } from 'lucide-react';
import { usePagination, TablePagination } from '../components/TablePagination';

const doctors = [
  { name: 'Dr. Alisher Qodirov', specialty: 'Bosh stomatolog', experience: '14 yil', patients: 428, rating: 4.9 },
  { name: 'Dr. Malika Yusupova', specialty: 'Terapevt stomatolog', experience: '8 yil', patients: 312, rating: 4.8 },
  { name: 'Dr. Nodir Jalilov', specialty: 'Ortodont', experience: '11 yil', patients: 265, rating: 4.9 },
  { name: 'Dr. Zarina Qarshieva', specialty: 'Bolalar stomatologi', experience: '6 yil', patients: 198, rating: 4.7 },
  { name: 'Dr. Sanjar Mirzaev', specialty: 'Jarroh stomatolog', experience: '9 yil', patients: 174, rating: 4.8 },
];

export function AdminDoctors() {
  const pg = usePagination(doctors, []);
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Shifokorlar</h1>
          <p>Shifokorlar jamoasi, ularning yo‘nalishlari va natijalari.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary"><Plus size={15} /> Shifokor qo‘shish</button>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>F.I.Sh.</th>
                <th>Ixtisos</th>
                <th>Tajriba</th>
                <th>Bemorlar</th>
                <th>Reyting</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageRows.map((d) => (
                <tr key={d.name}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.specialty}</td>
                  <td className="admin-cell-muted">{d.experience}</td>
                  <td>{d.patients}</td>
                  <td>⭐ {d.rating}</td>
                  <td className="admin-cell-right">
                    <button className="admin-icon-btn sm" aria-label="Tahrirlash"><Edit size={14} /></button>
                    <button className="admin-icon-btn sm danger" aria-label="O‘chirish"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>
    </div>
  );
}
