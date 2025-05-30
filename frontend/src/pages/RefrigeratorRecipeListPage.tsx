          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>부족 재료</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>대체 가능</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>보유 재료</span>
              </div>
            </div>
            <span style={{ color: '#666', fontSize: '12px' }}>총 {recipes.length.toLocaleString()}건</span>
          </div> 