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
  const { data: monthlyStats, isLoading: monthlyLoading, error: monthlyError } = useQuery<MonthlyStats[]>({
    queryKey: ['monthly-stats'],
    queryFn: async () => {
      console.log('[InsightsPage] ===== Fetching Monthly Stats =====');
      console.log('[InsightsPage] API URL: /articles/stats/monthly');
      try {
        const response = await api.get('/articles/stats/monthly');
        console.log('[InsightsPage] Monthly stats response:', {
          status: response.status,
          dataLength: response.data?.length || 0,
          data: response.data,
        });
        return response.data || [];
      } catch (error) {
        console.error('[InsightsPage] Monthly stats error:', error);
        throw error;
      }
    },
  });

  const { data: typeStats, isLoading: typeLoading, error: typeError } = useQuery<ArticleTypeStats[]>({
    queryKey: ['article-type-stats'],
    queryFn: async () => {
      console.log('[InsightsPage] ===== Fetching Type Stats =====');
      console.log('[InsightsPage] API URL: /articles/stats/types');
      try {
        const response = await api.get('/articles/stats/types');
        console.log('[InsightsPage] Type stats response:', {
          status: response.status,
          dataLength: response.data?.length || 0,
          data: response.data,
        });
        return response.data || [];
      } catch (error) {
        console.error('[InsightsPage] Type stats error:', error);
        throw error;
      }
    },
  });

  const { data: insights, isLoading: insightsLoading, error: insightsError } = useQuery<InsightsData>({
    queryKey: ['insights'],
    queryFn: async () => {
      console.log('[InsightsPage] ===== Fetching Insights =====');
      console.log('[InsightsPage] API URL: /articles/stats/insights');
      try {
        const response = await api.get('/articles/stats/insights');
        console.log('[InsightsPage] Insights response:', {
          status: response.status,
          data: response.data,
          topAuthors: response.data?.topAuthors?.length || 0,
          topEventTypes: response.data?.topEventTypes?.length || 0,
          monthlyTrends: response.data?.monthlyTrends?.length || 0,
          articleTypeDistribution: response.data?.articleTypeDistribution?.length || 0,
        });
        return response.data;
      } catch (error) {
        console.error('[InsightsPage] Insights error:', error);
        throw error;
      }
    },
  });

  const { data: timeline, isLoading: timelineLoading, error: timelineError } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline'],
    queryFn: async () => {
      console.log('[InsightsPage] ===== Fetching Timeline =====');
      console.log('[InsightsPage] API URL: /articles/stats/timeline');
      try {
        const response = await api.get('/articles/stats/timeline');
        console.log('[InsightsPage] Timeline response:', {
          status: response.status,
          dataLength: response.data?.length || 0,
          data: response.data,
        });
        return response.data || [];
      } catch (error) {
        console.error('[InsightsPage] Timeline error:', error);
        throw error;
      }
    },
  });

  const formatMonth = (year: number, month: number) => `${year}-${month.toString().padStart(2, '0')}`;

  const isLoading = monthlyLoading || typeLoading || insightsLoading || timelineLoading;
  const hasError = monthlyError || typeError || insightsError || timelineError;

  if (isLoading) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>인사이트 분석</h1>
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>인사이트 분석</h1>
        <div className="card" style={{ color: 'var(--danger-color)' }}>
          <h3>데이터를 불러오는 중 오류가 발생했습니다</h3>
          <p>Monthly: {monthlyError ? (monthlyError instanceof Error ? monthlyError.message : String(monthlyError)) : 'OK'}</p>
          <p>Type: {typeError ? (typeError instanceof Error ? typeError.message : String(typeError)) : 'OK'}</p>
          <p>Insights: {insightsError ? (insightsError instanceof Error ? insightsError.message : String(insightsError)) : 'OK'}</p>
          <p>Timeline: {timelineError ? (timelineError instanceof Error ? timelineError.message : String(timelineError)) : 'OK'}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우 체크
  const hasNoData = (!monthlyStats || monthlyStats.length === 0) &&
                    (!typeStats || typeStats.length === 0) &&
                    (!insights || (!insights.topAuthors?.length && !insights.topEventTypes?.length && !insights.monthlyTrends?.length && !insights.articleTypeDistribution?.length)) &&
                    (!timeline || timeline.length === 0);

  if (hasNoData) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>인사이트 분석</h1>
        <div className="card">
          <h3>데이터가 없습니다</h3>
          <p>인사이트를 표시하려면 먼저 신문 호수의 추출 작업을 완료해야 합니다.</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginTop: '1rem' }}>
            - 관리자 페이지에서 호수 관리로 이동<br />
            - 추출이 완료된 호수가 있는지 확인<br />
            - 추출이 완료되지 않은 호수는 '추출 시작' 버튼을 클릭하여 추출 작업을 시작하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>인사이트 분석</h1>

      {/* 월별 추이 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 기사 수 추이</h2>
          {monthlyStats && monthlyStats.length > 0 ? (
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
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
              월별 통계 데이터가 없습니다.
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>월별 기사 유형별 추이</h2>
          {monthlyStats && monthlyStats.length > 0 ? (
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
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
              월별 유형별 통계 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 기사 유형 분포 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형별 통계</h2>
          {typeStats && typeStats.length > 0 ? (
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
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
              기사 유형 통계 데이터가 없습니다.
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>기사 유형 분포</h2>
          {insights?.articleTypeDistribution && insights.articleTypeDistribution.length > 0 ? (
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
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
              기사 유형 분포 데이터가 없습니다.
            </div>
          )}
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

