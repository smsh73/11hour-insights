import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart 
} from 'recharts';

interface MonthlyStats {
  year: number;
  month: number;
  article_count: number;
  event_count: number;
  event_article_count?: number;
  testimony_count?: number;
  mission_count?: number;
  sermon_count?: number;
  author_count?: number;
}

interface ArticleTypeStats {
  article_type: string;
  count: number;
  percentage?: number;
}

interface InsightsData {
  topAuthors: Array<{ author: string; count: number }>;
  topEventTypes: Array<{ event_type: string; count: number }>;
  monthlyTrends: MonthlyStats[];
  articleTypeDistribution: ArticleTypeStats[];
}

interface TimelineEvent {
  id: number;
  event_type: string;
  event_date: string;
  event_title: string;
  description: string;
  location?: string;
  participants?: string[];
  article_title?: string;
  page_number: number;
  issue_year: number;
  issue_month: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

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

  const { data: insights } = useQuery<InsightsData>({
    queryKey: ['insights'],
    queryFn: async () => {
      const response = await api.get('/articles/stats/insights');
      return response.data;
    },
  });

  const { data: timeline } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline'],
    queryFn: async () => {
      const response = await api.get('/articles/stats/timeline');
      return response.data;
    },
  });

  const formatMonth = (year: number, month: number) => `${year}-${month.toString().padStart(2, '0')}`;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>인사이트 분석</h1>

      {/* 월별 추이 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 기사 수 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(d) => formatMonth(d.year, d.month)} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="article_count" stroke="#8884d8" name="기사 수" />
              <Line type="monotone" dataKey="event_count" stroke="#82ca9d" name="이벤트 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 기사 유형별 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(d) => formatMonth(d.year, d.month)} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="event_article_count" stackId="1" stroke="#8884d8" fill="#8884d8" name="행사" />
              <Area type="monotone" dataKey="testimony_count" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="간증" />
              <Area type="monotone" dataKey="mission_count" stackId="1" stroke="#ffc658" fill="#ffc658" name="선교" />
              <Area type="monotone" dataKey="sermon_count" stackId="1" stroke="#ff7300" fill="#ff7300" name="말씀" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 기사 유형 분포 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
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

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형 분포</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={insights?.articleTypeDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ article_type, percentage }) => `${article_type} ${percentage?.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {(insights?.articleTypeDistribution || []).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 상세 인사이트 */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>주요 필진</h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {insights.topAuthors.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {insights.topAuthors.map((author, index) => (
                    <li key={index} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{author.author}</span>
                      <span style={{ fontWeight: 'bold' }}>{author.count}건</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>데이터가 없습니다.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>주요 이벤트 유형</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={insights.topEventTypes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="event_type" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      {timeline && timeline.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>이벤트 타임라인</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ borderLeft: '2px solid #8884d8', paddingLeft: '1rem' }}>
              {timeline.map((event) => (
                <div key={event.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: '-1.5rem', 
                    top: '0.25rem', 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: '#8884d8' 
                  }} />
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {event.event_date} - {event.event_title}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    {event.event_type} {event.location && `· ${event.location}`}
                  </div>
                  {event.description && (
                    <div style={{ color: '#888', fontSize: '0.85rem' }}>
                      {event.description}
                    </div>
                  )}
                  <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {event.issue_year}년 {event.issue_month}월호 {event.page_number}면
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

