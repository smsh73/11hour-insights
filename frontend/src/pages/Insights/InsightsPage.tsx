import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyStats {
  year: number;
  month: number;
  article_count: number;
  event_count: number;
}

interface ArticleTypeStats {
  article_type: string;
  count: number;
}

export default function InsightsPage() {
  const { data: monthlyStats } = useQuery<MonthlyStats[]>({
    queryKey: ['monthly-stats'],
    queryFn: async () => {
      const response = await api.get('/articles/stats/monthly');
      return response.data;
    },
  });

  const { data: typeStats } = useQuery<ArticleTypeStats[]>({
    queryKey: ['article-type-stats'],
    queryFn: async () => {
      const response = await api.get('/articles/stats/types');
      return response.data;
    },
  });

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>인사이트</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 기사 수 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="article_count" stroke="#8884d8" name="기사 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 이벤트 수 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="event_count" stroke="#82ca9d" name="이벤트 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형별 통계</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeStats}>
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

