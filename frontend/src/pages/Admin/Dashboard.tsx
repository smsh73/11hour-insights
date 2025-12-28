import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  issues: number;
  articles: number;
  events: number;
  topArticleTypes: Array<{ article_type: string; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!stats) {
    return <div className="error">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>관리자 대시보드</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>총 호수</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {stats.issues}
          </p>
        </div>
        <div className="card">
          <h3 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>총 기사</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
            {stats.articles}
          </p>
        </div>
        <div className="card">
          <h3 style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>총 이벤트</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
            {stats.events}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형별 통계</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.topArticleTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ article_type, percent }) => `${article_type} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.topArticleTypes.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형별 개수</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topArticleTypes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="article_type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

