import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TimelineEvent {
  id: number;
  event_type: string;
  event_date: string;
  event_title: string;
  description: string;
  article_id: number;
}

export default function TimelinePage() {
  const { data: events, isLoading, error } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline-events'],
    queryFn: async () => {
      console.log('[TimelinePage] ===== Fetching Timeline Events =====');
      console.log('[TimelinePage] API URL: /timeline');
      try {
        const response = await api.get('/timeline');
        console.log('[TimelinePage] Timeline events response:', {
          status: response.status,
          dataLength: response.data?.length || 0,
          data: response.data,
        });
        
        if (response.data && Array.isArray(response.data)) {
          response.data.forEach((event: TimelineEvent, index: number) => {
            console.log(`[TimelinePage] Event ${index + 1}:`, {
              id: event.id,
              event_type: event.event_type,
              event_date: event.event_date,
              event_title: event.event_title,
              has_description: !!event.description,
            });
          });
        }
        
        console.log('[TimelinePage] ===== Timeline Events Fetched =====');
        return response.data || [];
      } catch (error) {
        console.error('[TimelinePage] ===== Fetch Timeline Events Error =====');
        console.error('[TimelinePage] Error:', error);
        console.error('[TimelinePage] ===== Fetch Timeline Events Error End =====');
        throw error;
      }
    },
  });

  if (isLoading) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>이벤트 타임라인</h1>
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>이벤트 타임라인</h1>
        <div className="card" style={{ color: 'var(--danger-color)' }}>
          <h3>이벤트를 불러오는 중 오류가 발생했습니다</h3>
          <p>{error instanceof Error ? error.message : '알 수 없는 오류'}</p>
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

  if (!events || events.length === 0) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem' }}>이벤트 타임라인</h1>
        <div className="card">
          <h3>이벤트가 없습니다</h3>
          <p>타임라인을 표시하려면 먼저 신문 호수의 추출 작업을 완료해야 합니다.</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginTop: '1rem' }}>
            - 관리자 페이지에서 호수 관리로 이동<br />
            - 추출이 완료된 호수가 있는지 확인<br />
            - 추출이 완료되지 않은 호수는 '추출 시작' 버튼을 클릭하여 추출 작업을 시작하세요
          </p>
        </div>
      </div>
    );
  }

  const groupedEvents = events.reduce((acc, event) => {
    const date = event.event_date ? format(new Date(event.event_date), 'yyyy-MM-dd') : '날짜 없음';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>이벤트 타임라인</h1>

      <div style={{ position: 'relative', paddingLeft: '2rem' }}>
        {sortedDates.map((date, dateIndex) => (
          <div key={date} style={{ marginBottom: '2rem' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--primary-color)',
                border: '3px solid white',
                boxShadow: '0 0 0 2px var(--primary-color)',
                marginTop: '0.25rem',
              }}
            />
            {dateIndex < sortedDates.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '5.5px',
                  top: '16px',
                  width: '2px',
                  height: 'calc(100% + 1rem)',
                  background: 'var(--border-color)',
                }}
              />
            )}
            <div style={{ marginLeft: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>
                {date === '날짜 없음' ? date : format(new Date(date), 'yyyy년 MM월 dd일', { locale: ko })}
              </h2>
              {groupedEvents[date].map((event) => (
                <div key={event.id} className="card" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <h3>{event.event_title}</h3>
                    <span
                      style={{
                        background: 'var(--bg-color)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      {event.event_type}
                    </span>
                  </div>
                  <p style={{ color: 'var(--secondary-color)' }}>{event.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

