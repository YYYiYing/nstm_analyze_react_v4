import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_USER_ID = `local-user-${uuidv4()}`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC0CB', '#A52A2A'];
const VENUE_COLORS = { '北館': '#0088FE', '南館': '#00C49F', '未知場域': '#FFBB28' };
const WORK_TYPE_COLORS = { '水': '#007bff', '電': '#fd7e14', '消防': '#dc3545', '營繕': '#28a745', '其他': '#6c757d'};

const NORTH_AREAS_FOR_DROPDOWN = ['A區', 'B區', 'C區', 'D區', 'E區','F區','G區', 'I區', 'P區', '戶外'];
const SOUTH_AREAS_FOR_DROPDOWN = ['北側', '南側', '東側', '西側', '中庭', '戶外'];
const UNIDENTIFIABLE_AREA_TAG = '無法識別';

const qtyUnitPattern = /(.*?)\s*(?:[*xXｘX*＊]?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]{1,4}(?:[²³])?))?$/;
const EXCLUDED_TOOLS_OR_TERMS_FOR_UNCATEGORIZED = [];
const INCOMPLETE_MATERIAL_PREFIXES_FOR_UNCATEGORIZED = /^(?:LED燈泡|LED燈管|T5燈管|日光燈|PL燈|BB燈|CCFL燈|探照燈|緊急照明燈|燈泡|燈管|燈座|龍頭|水龍頭|閥|球閥|球塞閥|馬桶|電線|開關|插座|風扇|馬達|泵浦|油漆|水泥|磁磚|玻璃|木板|板材|角材|螺絲|螺帽|墊片|軟管|水管|鉄管|鐵管|PVC管|ABS管|不鏽鋼管|不銹鋼管|高壓軟管|三角凡而|立栓|壁栓|混合龍頭|沖洗器|沖水閥|浮球|落水頭|排水管|排風扇|抽風機|斷路器|無熔絲開關|電磁開關|安定器|啟動器|變壓器|電池|軸承|皮帶|濾網|濾心|矽利康|填縫劑|黏著劑|接著劑|潤滑油|清潔劑|消毒水|除草劑|殺蟲劑|兩件式坐式馬桶|制水電磁閥)-$/i;

const isColorDark = (hexColor) => {
  if (!hexColor || typeof hexColor !== 'string') return false;
  const hex = hexColor.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16); g = parseInt(hex.substring(2, 4), 16); b = parseInt(hex.substring(4, 6), 16);
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance < 128;
};

const App = () => {
  const [userId, setUserId] = useState(LOCAL_USER_ID);
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [isXlsxReady, setIsXlsxReady] = useState(false);
  const [isHtml2canvasReady, setIsHtml2canvasReady] = useState(false);
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [dashboardFilteredRecords, setDashboardFilteredRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messageConfig, setMessageConfig] = useState({ show: false, text: '', type: 'info' });
  const [confirmModalConfig, setConfirmModalConfig] = useState({ show: false, message: '', onConfirm: null, onCancel: null });
  const [geminiAnalysisResult, setGeminiAnalysisResult] = useState(null);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [topThreeAreasFaultData, setTopThreeAreasFaultData] = useState([]);
  const [managedFaultReasons, setManagedFaultReasons] = useState([]);
  const [managedMaterialNames, setManagedMaterialNames] = useState([]);
  const [newFaultReason, setNewFaultReason] = useState('');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [uncategorizedFaultDescriptions, setUncategorizedFaultDescriptions] = useState([]);
  const [uncategorizedMaterialStrings, setUncategorizedMaterialStrings] = useState([]);

  useEffect(() => {
    const loadScript = (src, onReady, onError) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = onReady;
        script.onerror = onError;
        document.head.appendChild(script);
        return () => {
            try { document.head.removeChild(script); } catch (e) { /* ignore */ }
        };
    };

    if (!window.XLSX) {
        loadScript(
            "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
            () => setIsXlsxReady(true),
            () => setError("無法載入 Excel 處理函式庫。")
        );
    } else {
        setIsXlsxReady(true);
    }

    if (!window.html2canvas) {
        loadScript(
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
            () => setIsHtml2canvasReady(true),
            () => setError("無法載入圖片擷取函式庫。")
        );
    } else {
        setIsHtml2canvasReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      setUncategorizedFaultDescriptions([]);
      setUncategorizedMaterialStrings([]);
      return;
    }
    const tempUncategorizedFaults = new Set();
    records.forEach(recordData => {
      if (recordData.faultDescription && recordData.faultDescription.trim() !== "") {
        const isCoveredByManaged = managedFaultReasons.some(reason =>
          recordData.faultDescription.toLowerCase().includes(reason.text.toLowerCase())
        );
        if (!isCoveredByManaged) {
          tempUncategorizedFaults.add(recordData.faultDescription);
        }
      }
    });
    setUncategorizedFaultDescriptions(Array.from(tempUncategorizedFaults));
    const allPotentiallyUncategorizedMaterialStrings = new Set();
    records.forEach(record => {
      if (record.uncategorizedMaterialStrings && Array.isArray(record.uncategorizedMaterialStrings)) {
        record.uncategorizedMaterialStrings.forEach(str => {
          if (str && str.trim() !== "") {
            allPotentiallyUncategorizedMaterialStrings.add(str.trim());
          }
        });
      }
    });
    const finalDisplayableUncategorizedMaterials = new Set();
    Array.from(allPotentiallyUncategorizedMaterialStrings).forEach(storedUncatString => {
      const qtyMatch = storedUncatString.match(qtyUnitPattern);
      let namePartFromStoredString = qtyMatch && qtyMatch[1] ? qtyMatch[1].trim() : storedUncatString.trim();
      const namePartLower = namePartFromStoredString.toLowerCase();
      if (!namePartFromStoredString || namePartFromStoredString.length < 1 || EXCLUDED_TOOLS_OR_TERMS_FOR_UNCATEGORIZED.some(term => namePartLower.includes(term.toLowerCase()))) {
        return;
      }
      let isNowConsideredManaged = false;
      for (const managedMat of managedMaterialNames) {
        const managedNameLower = managedMat.name.toLowerCase();
        if (namePartLower.includes(managedNameLower) || managedNameLower.includes(namePartLower)) {
          isNowConsideredManaged = true;
          break;
        }
      }
      if (!isNowConsideredManaged) {
        if (INCOMPLETE_MATERIAL_PREFIXES_FOR_UNCATEGORIZED.test(namePartFromStoredString)) {
          if (!managedMaterialNames.some(m => m.name.toLowerCase() === namePartLower)) {
            finalDisplayableUncategorizedMaterials.add(storedUncatString);
          }
        } else {
          finalDisplayableUncategorizedMaterials.add(storedUncatString);
        }
      }
    });
    setUncategorizedMaterialStrings(Array.from(finalDisplayableUncategorizedMaterials));
  }, [records, managedFaultReasons, managedMaterialNames, isAuthReady]);

  useEffect(() => { setAreaFilter(""); }, [venueFilter]);
  useEffect(() => { setMonthFilter(""); }, [yearFilter]);

  const showAppMessage = (text, type = 'info') => setMessageConfig({ show: true, text, type });
  const showConfirm = (message, onConfirmCallback) => {
    setConfirmModalConfig({
      show: true, message,
      onConfirm: () => { onConfirmCallback(); setConfirmModalConfig({ show: false, message: '', onConfirm: null, onCancel: null }); },
      onCancel: () => setConfirmModalConfig({ show: false, message: '', onConfirm: null, onCancel: null })
    });
  };

  const callGeminiApi = async (prompt) => {
    setIsGeminiLoading(true);
    setGeminiAnalysisResult(null);
    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = "AIzaSyAbZ-M2IktxokX0LaYGFpl0wIKozTuHkJY";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API 請求失敗，狀態碼: ${response.status}. ${errorBody}`);
      }
      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        return text;
      } else {
        throw new Error("Gemini API 回應格式不正確或無內容。");
      }
    } catch (err) {
      console.error("呼叫 Gemini API 失敗:", err);
      setError(`智能分析失敗: ${err.message}`);
      return null;
    } finally {
      setIsGeminiLoading(false);
    }
  };

  const handleGeneratePreventiveMaintenanceSuggestions = async () => {
    setIsGeminiModalOpen(true);
    setGeminiAnalysisResult(null);
    if (dashboardFilteredRecords.length === 0) {
      setGeminiAnalysisResult("目前篩選條件下無資料可供分析以產生維護建議。請調整篩選或上傳更多資料。");
      setIsGeminiLoading(false);
      return;
    }
    const totalRecords = dashboardFilteredRecords.length;
    const topFaults = analyzeFaultTypesFromDescription(dashboardFilteredRecords).slice(0, 5);
    const topMaterials = materialUsageData.slice(0, 5);
    let dataSummary = `目前分析了 ${totalRecords} 筆維修紀錄。\n`;
    dataSummary += `主要故障類型統計：${topFaults.map(f => `${f.name} (${f.value}次)`).join('；') || '尚無資料'}\n`;
    dataSummary += `故障高發區域統計：${areaHotspotData.slice(0,5).map(a => `${a.name} (${a.value}次)`).join('；') || '尚無資料'}\n`;
    dataSummary += `常用維修材料統計：${topMaterials.map(m => `${m.name} (用量${m.數量})`).join('；') || '尚無資料'}\n`;
    let detailedAreaFaults = "故障高發熱區詳細故障類型：\n";
    topThreeAreasFaultData.forEach(areaData => {
      detailedAreaFaults += `- ${areaData.areaFullName} (總計 ${areaData.totalRepairs} 次)：${areaData.faultTypes.map(ft => `${ft.name} (${ft.value}次)`).join(', ') || '無詳細故障分類'}\n`;
    });
    const prompt = `作為設施維護專家，請根據以下維修數據摘要和詳細數據，提供深入的預防性維護建議、潛在風險推論、以及可能的優化方向。請以繁體中文提供清晰的階層式條列建議，嚴格依照以下編號格式與適當縮排： 一、 (一) 1. (1) a. (a)，避免過度使用粗體。

維修數據摘要：
${dataSummary}
${detailedAreaFaults}

篩選條件：
- 年份：${yearFilter || '所有'}
- 月份：${monthFilter || '所有'}
- 場域：${venueFilter || '所有'}
- 區域：${areaFilter || '所有'}
- 工作類型：${workTypeFilter || '所有'}

請專注於從數據中推斷圖表可能未直接顯示的潛在問題或根本原因。例如，若某區域特定類型故障（如堵塞）頻繁，請推測可能的深層原因（如該區域管線老化或設計問題）並提出具體檢查或改進建議。

建議報告格式範例（請嚴格遵守此階層編號與縮排）：
一、潛在風險與根本原因推論
    (一) 針對 [高發故障類型A]
        1.  可能原因
            (1) [根據數據推測，例如：某區域的[高發故障類型A]可能與[推測原因1]有關]
            (2) [推測原因2]
        2.  潛在風險
            (1) [說明]
    (二) 針對熱點區域 [區域X] 的 [特定故障Y]
        1.  可能原因
            (1) [例如：D區的堵塞問題頻繁，可能指示該區域的污水幹管存在淤積或設計不良]
        2.  建議行動
            (1) [例如：建議對D區污水幹管進行內視鏡檢查]
二、預防性維護措施建議
    (一) 巡檢重點調整
        1.  針對 [高發區域A]
            (1) [建議巡檢項目]
        2.  針對 [高發故障類型B]
            (1) [建議巡檢頻率或方法]
    (二) 材料庫存與採購優化
        1.  根據 [常用材料C] 的高消耗量，建議 [庫存調整策略]
三、長期維護策略優化方向
    (一) [例如：考慮對[特定老舊設施/區域]進行預算編列以進行系統性更新]
    (二) [例如：建議引入[新技術/方法]以改善[特定問題]的維護效率]

請確保您的分析具有洞察力，而不僅僅是重複數據。
`;
    const suggestions = await callGeminiApi(prompt);
    setGeminiAnalysisResult(suggestions || "無法獲取預防性維護建議，請檢查錯誤訊息或稍後再試。");
  };

  const analyzeFaultTypesFromDescription = (recordsToAnalyze) => {
    const faultCounts = {};
    recordsToAnalyze.forEach(record => {
      if (record.faultTags && record.faultTags.length > 0) {
        record.faultTags.forEach(tag => {
          faultCounts[tag] = (faultCounts[tag] || 0) + 1;
        });
      } else if (record.faultDescription) {
        faultCounts['其他/未分類 (舊)'] = (faultCounts['其他/未分類 (舊)'] || 0) + 1;
      }
    });
    return Object.entries(faultCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const processRecord = (rawRecord, index, currentManagedFaultReasons, currentManagedMaterialNames) => {
    const newRecord = {
      id: uuidv4(),
      originalIndex: index,
      workAttribute: rawRecord['工作屬性'] || '',
      requestDate: formatDate(rawRecord['請修日期']),
      requestTime: formatTime(rawRecord['請修時間']),
      faultDescription: rawRecord['故障描述'] || '',
      handlingStatus: rawRecord['處理情形'] || '',
      validationErrors: [],
      uncategorizedMaterialStrings: [],
    };
    if (!newRecord.workAttribute) newRecord.validationErrors.push('缺少「工作屬性」');
    if (!newRecord.requestDate) newRecord.validationErrors.push('「請修日期」格式錯誤或缺少');
    newRecord.isValid = newRecord.validationErrors.length === 0;
    const descriptionLower = newRecord.faultDescription.toLowerCase();
    if (descriptionLower.includes('北館')) newRecord.venue = '北館';
    else if (descriptionLower.includes('南館')) newRecord.venue = '南館';
    else newRecord.venue = '未知場域';
    newRecord.area = UNIDENTIFIABLE_AREA_TAG;
    if (newRecord.venue === '北館') {
      const northAreaKeywords = {'A區':'A區', 'B區':'B區', 'C區':'C區', 'D區':'D區', 'E區':'E區','F區':'F區','G區':'G區', 'I區':'I區', 'P區':'P區', '戶外':'戶外'};
      for (const [keyword, areaValue] of Object.entries(northAreaKeywords)) {
        if (descriptionLower.includes(keyword.toLowerCase())) { newRecord.area = areaValue; break; }
      }
    } else if (newRecord.venue === '南館') {
      const southAreaKeywords = {
        '中庭': '中庭', '東南側': '東南側', '東南': '東南側', '西南側': '西南側', '西南': '西南側',
        '東北側': '東北側', '東北': '東北側', '西北側': '西北側', '西北': '西北側',
        '東側': '東側', '西側': '西側', '南側': '南側', '北側': '北側', '戶外': '戶外',
      };
      for (const [keyword, areaValue] of Object.entries(southAreaKeywords)) {
        if (descriptionLower.includes(keyword.toLowerCase())) { newRecord.area = areaValue; break; }
      }
    }
    const workTypeMap = { '水': '水', '電': '電', '營繕': '營繕', '消防': '消防' };
    newRecord.workTypeClassification = workTypeMap[newRecord.workAttribute] || '其他';
    newRecord.faultTags = [];
    if (newRecord.faultDescription && currentManagedFaultReasons && currentManagedFaultReasons.length > 0) {
      currentManagedFaultReasons.forEach(reason => {
        if (descriptionLower.includes(reason.text.toLowerCase())) {
          if (!newRecord.faultTags.includes(reason.text)) {
            newRecord.faultTags.push(reason.text);
          }
        }
      });
    }
    if (newRecord.faultTags.length === 0 && newRecord.faultDescription.length > 0) {
      newRecord.faultTags.push('未分類故障');
    }
    newRecord.materialsUsed = [];
    let materialText = newRecord.handlingStatus;
    materialText = materialText.replace(/更換RO管更換RO管/g, "更換RO管");
    const segments = materialText.split(/(?<!各)\s*(?:、|&|以及|與|及)\s*(?!各)/);
    const EXCLUDED_TOOLS_OR_TERMS = [];
    const INCOMPLETE_MATERIAL_PREFIXES = INCOMPLETE_MATERIAL_PREFIXES_FOR_UNCATEGORIZED;
    const provisionalFoundMaterials = [];
    segments.forEach(segment => {
      let currentSegment = segment.trim();
      if (!currentSegment) return;
      const leadingVerbs = /^(?:已用|已更換|更換|使用|安裝|已將|將|把|計|更換了|更新|換裝|新裝|加裝|拆換|拆除並更新|調整|清潔|修復|處理)\s*/i;
      currentSegment = currentSegment.replace(leadingVerbs, '').trim();
      const trailingJunk = /(?:等材料|等零件)?(?:將.*?重新配管|將.*?疏通|測試正常|恢復正常|完成|修復|處理完畢|功能正常|等作業|等調整|等事項|等工作)。?$/i;
      currentSegment = currentSegment.replace(trailingJunk, '').trim().replace(/\.$/,'');
      if (!currentSegment) return;
      if (EXCLUDED_TOOLS_OR_TERMS.length > 0 && EXCLUDED_TOOLS_OR_TERMS.some(term => currentSegment.toLowerCase().includes(term.toLowerCase()))) return;
      if (currentSegment === "PT高壓軟管-½\"白扁線-2.0mm*2C") {
        let ptManaged = false;
        let wireManaged = false;
        if (currentManagedMaterialNames.some(m => m.name.toLowerCase() === "pt高壓軟管-½\"")) {
          provisionalFoundMaterials.push({ name: "PT高壓軟管-½\"", quantity: 1, unit: '個' });
          ptManaged = true;
        }
        if (currentManagedMaterialNames.some(m => m.name.toLowerCase() === "白扁線-2.0mm*2c")) {
          provisionalFoundMaterials.push({ name: "白扁線-2.0mm*2C", quantity: 1, unit: '個' });
          wireManaged = true;
        }
        if (!ptManaged) newRecord.uncategorizedMaterialStrings.push("PT高壓軟管-½\"");
        if (!wireManaged) newRecord.uncategorizedMaterialStrings.push("白扁線-2.0mm*2C");
        return;
      }
      const currentQtyMatch = currentSegment.match(qtyUnitPattern);
      let namePartForCurrentSegment = currentQtyMatch && currentQtyMatch[1] ? currentQtyMatch[1].trim() : currentSegment.trim();
      let quantity = currentQtyMatch && currentQtyMatch[2] ? parseFloat(currentQtyMatch[2]) : 1;
      let unit = currentQtyMatch && currentQtyMatch[3] ? currentQtyMatch[3].trim() : '個';
      if (!namePartForCurrentSegment) return;
      let matchedToManaged = false;
      if (currentManagedMaterialNames && currentManagedMaterialNames.length > 0) {
        const sortedManagedMaterialNames = [...currentManagedMaterialNames].sort((a,b) => b.name.length - a.name.length);
        for (const managedMat of sortedManagedMaterialNames) {
          const managedNameLower = managedMat.name.toLowerCase();
          const namePartLower = namePartForCurrentSegment.toLowerCase();
          if (namePartLower.startsWith(managedNameLower)) {
            const remainder = namePartForCurrentSegment.substring(managedMat.name.length).trim();
            if (remainder === "" || remainder.match(/^[-(\s\w½¼¾"'.呎\/#*:,+\-\\]*$/i)) {
              let nameForStorage = namePartForCurrentSegment;
              const cleanedNameMatch = nameForStorage.match(qtyUnitPattern);
              if (cleanedNameMatch && cleanedNameMatch[1]) {
                nameForStorage = cleanedNameMatch[1].trim();
              }
              if (!(INCOMPLETE_MATERIAL_PREFIXES.test(nameForStorage) && !currentManagedMaterialNames.some(m => m.name.toLowerCase() === nameForStorage.toLowerCase()))) {
                provisionalFoundMaterials.push({ name: nameForStorage, quantity, unit });
                matchedToManaged = true;
                break;
              }
            }
          }
          if (!matchedToManaged && namePartLower.includes(managedNameLower)) {
            provisionalFoundMaterials.push({ name: managedMat.name, quantity, unit });
            matchedToManaged = true;
            break;
          }
        }
      }
      if (!matchedToManaged) {
        if (namePartForCurrentSegment.length >= 1 && !(EXCLUDED_TOOLS_OR_TERMS.length > 0 && EXCLUDED_TOOLS_OR_TERMS.some(term => namePartForCurrentSegment.toLowerCase().includes(term.toLowerCase())))) {
          if (INCOMPLETE_MATERIAL_PREFIXES.test(namePartForCurrentSegment)) {
            if (!currentManagedMaterialNames.some(m => m.name.toLowerCase() === namePartForCurrentSegment.toLowerCase())) {
              newRecord.uncategorizedMaterialStrings.push(currentSegment);
            }
          } else {
            newRecord.uncategorizedMaterialStrings.push(currentSegment);
          }
        }
      }
    });
    const aggregatedMaterials = new Map();
    provisionalFoundMaterials.forEach(item => {
      if (EXCLUDED_TOOLS_OR_TERMS.length > 0 && EXCLUDED_TOOLS_OR_TERMS.includes(item.name)) return;
      if (INCOMPLETE_MATERIAL_PREFIXES.test(item.name) && !currentManagedMaterialNames.some(m => m.name.toLowerCase() === item.name.toLowerCase())) {
        return;
      }
      const existing = aggregatedMaterials.get(item.name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        aggregatedMaterials.set(item.name, { name: item.name, quantity: item.quantity });
      }
    });
    newRecord.materialsUsed = Array.from(aggregatedMaterials.values());
    const toiletMaterialIndex = newRecord.materialsUsed.findIndex(m => m.name === "兩件式坐式馬桶" || m.name === "兩件式馬桶");
    if (toiletMaterialIndex !== -1) {
      const toiletMaterial = newRecord.materialsUsed[toiletMaterialIndex];
      if (toiletMaterial.quantity > 1) {
        const originalMentions = (newRecord.handlingStatus.match(/兩件式(坐式)?馬桶/gi) || []).length;
        if (originalMentions === 1) {
          newRecord.materialsUsed[toiletMaterialIndex] = { ...toiletMaterial, quantity: 1 };
        }
      }
    }
    newRecord.uploadTimestamp = new Date().toISOString();
    return newRecord;
  };

  const handleFileUpload = async (event) => {
    if (!isXlsxReady) {
      showAppMessage("Excel 處理函式庫尚未準備就緒。", "error");
      return;
    }
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        if (!window.XLSX) throw new Error("XLSX library is not loaded.");
        const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 0, defval: "" });
        const processedData = jsonData.map((row, index) => processRecord(row, index + 1, managedFaultReasons, managedMaterialNames));
        let validCount = 0; let invalidCount = 0;
        const newRecords = [];
        processedData.forEach(record => {
          if (record.isValid) {
            newRecords.push(record);
            validCount++;
          } else {
            console.warn("上傳時跳過無效紀錄:", record.validationErrors, record.originalIndex);
            invalidCount++;
          }
        });
        setRecords(prevRecords => [...prevRecords, ...newRecords].sort((a, b) => {
          const timeA = a.requestTime ? convertTo24Hour(a.requestTime) : "00:00";
          const timeB = b.requestTime ? convertTo24Hour(b.requestTime) : "00:00";
          const dateA = new Date(`${a.requestDate} ${timeA}`);
          const dateB = new Date(`${b.requestDate} ${timeB}`);
          return dateB - dateA;
        }));
        showAppMessage(`${validCount} 條有效紀錄已上傳並加入列表！\n${invalidCount} 條無效紀錄被跳過。`, 'success');
      } catch (err) {
        console.error("檔案處理錯誤:", err);
        setError(`檔案處理失敗: ${err.message}`);
      } finally {
        setIsLoading(false);
        if(event.target) event.target.value = null;
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return '';
    try {
      let date;
      if (dateInput instanceof Date) date = dateInput;
      else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        if (typeof dateInput === 'number') {
          if (isXlsxReady && window.XLSX && window.XLSX.SSF) {
            const parsed = window.XLSX.SSF.parse_date_code(dateInput);
            if(parsed) date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
          } else console.warn("XLSX.SSF not available for date parsing from number.");
        } else {
          const isoAttempt = new Date(dateInput);
          if (!isNaN(isoAttempt.getTime())) date = isoAttempt;
          else {
            const partsSlash = dateInput.split('/');
            const partsDash = dateInput.split('-');
            if (partsSlash.length === 3 && parseInt(partsSlash[0]) > 1000) date = new Date(partsSlash[0], partsSlash[1] - 1, partsSlash[2]);
            else if (partsDash.length === 3 && parseInt(partsDash[0]) > 1000) date = new Date(partsDash[0], partsDash[1] - 1, partsDash[2]);
            else if (partsSlash.length === 3) date = new Date(partsSlash[2], partsSlash[0] - 1, partsSlash[1]);
            else if (partsDash.length === 3) date = new Date(partsDash[2], partsDash[0] - 1, partsDash[1]);
          }
        }
      }
      if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
      }
    } catch (e) { console.warn("日期格式化錯誤:", dateInput, e); }
    return '';
  };
  const formatTime = (timeInput) => {
    if (!timeInput) return '';
    try {
      let date;
      if (timeInput instanceof Date) date = timeInput;
      else if (typeof timeInput === 'number') {
        const totalSeconds = Math.round(timeInput * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        date = new Date(0, 0, 0, hours, minutes);
      } else if (typeof timeInput === 'string') {
        const timeParts = timeInput.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1], 10);
          const minutes = parseInt(timeParts[2], 10);
          const ampm = timeParts[4];
          if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm && ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
          date = new Date(0, 0, 0, hours, minutes);
        } else {
          const directDate = new Date(`1970/01/01 ${timeInput}`);
          if (!isNaN(directDate.getTime())) date = directDate;
        }
      }
      if (date && !isNaN(date.getTime())) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12; hours = hours ? hours : 12;
        return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
      }
    } catch (e) { console.warn("時間格式化錯誤:", timeInput, e); }
    return '';
  };
  const convertTo24Hour = (time12h) => {
    if (!time12h) return "00:00";
    const [time, modifier] = time12h.split(' ');
    if(!modifier) {
        if(time.match(/^\d{1,2}:\d{2}$/)) return time.padStart(5, '0');
        return "00:00";
    }
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  useEffect(() => {
    let tempFilteredRecords = records.filter(record => record.isValid);
    if (yearFilter) tempFilteredRecords = tempFilteredRecords.filter(r => r.requestDate && r.requestDate.startsWith(yearFilter));
    if (monthFilter) {
      const formattedMonth = monthFilter.padStart(2, '0');
      tempFilteredRecords = tempFilteredRecords.filter(r => r.requestDate && r.requestDate.substring(5, 7) === formattedMonth);
    }
    if (searchTerm) {
      tempFilteredRecords = tempFilteredRecords.filter(record =>
        record.faultDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.handlingStatus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.materialsUsed && record.materialsUsed.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (record.faultTags && record.faultTags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    if (venueFilter) tempFilteredRecords = tempFilteredRecords.filter(record => record.venue === venueFilter);
    if (areaFilter) tempFilteredRecords = tempFilteredRecords.filter(record => record.area === areaFilter);
    if (workTypeFilter) tempFilteredRecords = tempFilteredRecords.filter(record => record.workTypeClassification === workTypeFilter);
    setFilteredRecords(tempFilteredRecords);
  }, [records, searchTerm, venueFilter, areaFilter, workTypeFilter, yearFilter, monthFilter]);

  useEffect(() => {
    let tempDashboardRecords = records.filter(record => record.isValid);
    if (yearFilter) tempDashboardRecords = tempDashboardRecords.filter(r => r.requestDate && r.requestDate.startsWith(yearFilter));
    if (monthFilter) {
      const formattedMonth = monthFilter.padStart(2, '0');
      tempDashboardRecords = tempDashboardRecords.filter(r => r.requestDate && r.requestDate.substring(5, 7) === formattedMonth);
    }
    if (venueFilter) tempDashboardRecords = tempDashboardRecords.filter(record => record.venue === venueFilter);
    if (areaFilter) tempDashboardRecords = tempDashboardRecords.filter(record => record.area === areaFilter);
    if (workTypeFilter) tempDashboardRecords = tempDashboardRecords.filter(record => record.workTypeClassification === workTypeFilter);
    setDashboardFilteredRecords(tempDashboardRecords);
  }, [records, venueFilter, areaFilter, workTypeFilter, yearFilter, monthFilter]);

  const venueData = useMemo(() => {
    const counts = dashboardFilteredRecords.reduce((acc, record) => { acc[record.venue] = (acc[record.venue] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [dashboardFilteredRecords]);

  const areaHotspotData = useMemo(() => {
    const counts = dashboardFilteredRecords.reduce((acc, record) => { const key = `${record.venue} - ${record.area}`; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dashboardFilteredRecords]);

  useEffect(() => {
    if (areaHotspotData.length > 0) {
      const top3 = areaHotspotData.slice(0, 3);
      const faultDataForTopAreas = top3.map((areaInfo, areaIndex) => {
        const [venue, areaName] = areaInfo.name.split(' - ');
        const recordsForThisArea = dashboardFilteredRecords.filter(
          r => r.venue === venue && r.area === areaName
        );
        const faultTypes = analyzeFaultTypesFromDescription(recordsForThisArea);
        const barColor = COLORS[areaIndex % COLORS.length];
        return {
          areaFullName: areaInfo.name,
          totalRepairs: areaInfo.value,
          faultTypes: faultTypes.slice(0, 5),
          barColor: barColor
        };
      });
      setTopThreeAreasFaultData(faultDataForTopAreas);
    } else {
      setTopThreeAreasFaultData([]);
    }
  }, [areaHotspotData, dashboardFilteredRecords]);

  const calculateMaintenanceTrend = (sourceRecords, yearF, monthF) => {
    const countsByTimePeriod = sourceRecords.reduce((acc, record) => {
      if (record.requestDate && record.isValid) {
        let timeKey;
        if (yearF && !monthF) {
          timeKey = record.requestDate.substring(5, 7) + '月';
        } else if (yearF && monthF) {
          timeKey = record.requestDate.substring(8, 10) + '日';
        } else {
          timeKey = record.requestDate.substring(0, 7);
        }
        acc[timeKey] = (acc[timeKey] || 0) + 1;
      }
      return acc;
    }, {});
    return Object.entries(countsByTimePeriod)
      .map(([name, value]) => ({ name, 維修數量: value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const dashboardMaintenanceTrendData = useMemo(() => {
      return calculateMaintenanceTrend(dashboardFilteredRecords, yearFilter, monthFilter);
  }, [dashboardFilteredRecords, yearFilter, monthFilter]);

  const overallMaintenanceTrendByWorkType = useMemo(() => {
    const monthlyData = {};
    records.filter(r => r.isValid && r.requestDate).forEach(record => {
      const month = record.requestDate.substring(5, 7);
      const monthKey = `${month}月`;
      const workType = record.workTypeClassification;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { name: monthKey, '水': 0, '電': 0, '消防': 0, '營繕': 0, '其他': 0 };
      }
      if (WORK_TYPE_COLORS[workType]) {
        monthlyData[monthKey][workType]++;
      } else if (workType) {
        monthlyData[monthKey]['其他']++;
      }
    });
    return Object.values(monthlyData).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const materialUsageData = useMemo(() => {
    const counts = dashboardFilteredRecords.reduce((acc, record) => {
      if (record.materialsUsed) record.materialsUsed.forEach(material => {
        acc[material.name] = (acc[material.name] || 0) + material.quantity;
      });
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, 數量: value })).sort((a, b) => b.數量 - a.數量);
  }, [dashboardFilteredRecords]);

  const availableAreaOptions = useMemo(() => {
    let options = []; let includeUnidentifiable = false;
    if (venueFilter === '北館') {
      options = [...NORTH_AREAS_FOR_DROPDOWN];
      includeUnidentifiable = records.some(r => r.isValid && r.venue === '北館' && r.area === UNIDENTIFIABLE_AREA_TAG);
    } else if (venueFilter === '南館') {
      options = [...SOUTH_AREAS_FOR_DROPDOWN];
      const otherSouthDataAreas = [...new Set(records.filter(r => r.isValid && r.venue === '南館' && r.area && !SOUTH_AREAS_FOR_DROPDOWN.includes(r.area) && r.area !== UNIDENTIFIABLE_AREA_TAG).map(r => r.area))];
      options = [...options, ...otherSouthDataAreas];
      includeUnidentifiable = records.some(r => r.isValid && r.venue === '南館' && r.area === UNIDENTIFIABLE_AREA_TAG);
    } else if (venueFilter === '未知場域') {
      const unknownVenueSpecificAreas = [...new Set(records.filter(r => r.isValid && r.venue === '未知場域' && r.area).map(r => r.area))];
      options = unknownVenueSpecificAreas.length > 0 ? unknownVenueSpecificAreas : [UNIDENTIFIABLE_AREA_TAG];
    } else { options = [...new Set(records.filter(r => r.isValid && r.area).map(r => r.area))]; }
    if (includeUnidentifiable && !options.includes(UNIDENTIFIABLE_AREA_TAG)) options.push(UNIDENTIFIABLE_AREA_TAG);
    return options.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [venueFilter, records]);

  const availableYearOptions = useMemo(() => {
    const years = new Set(records.filter(r => r.isValid && r.requestDate).map(r => r.requestDate.substring(0,4)));
    return Array.from(years).sort((a,b) => b.localeCompare(a));
  }, [records]);

  const availableMonthOptions = useMemo(() => {
    if (!yearFilter && records.length > 0) {
      const months = new Set(records.filter(r => r.isValid && r.requestDate).map(r => r.requestDate.substring(5,7)));
      return Array.from(months).map(m => parseInt(m, 10).toString()).sort((a,b) => parseInt(a) - parseInt(b));
    }
    if (!yearFilter && records.length === 0) {
      return Array.from({length: 12}, (_, i) => (i + 1).toString());
    }
    const months = new Set(
      records
        .filter(r => r.isValid && r.requestDate && r.requestDate.startsWith(yearFilter))
        .map(r => r.requestDate.substring(5,7))
    );
    return Array.from(months).map(m => parseInt(m, 10).toString()).sort((a,b) => parseInt(a) - parseInt(b));
  }, [records, yearFilter]);

  const exportToExcel = () => {
    const recordsToExport = filteredRecords;
    if (!isXlsxReady) { showAppMessage("Excel 處理函式庫尚未準備就緒，無法匯出。", "error"); return; }
    if (recordsToExport.length === 0) { showAppMessage("沒有資料可供匯出。", "info"); return; }
    setIsLoading(true);
    try {
      if (!window.XLSX) throw new Error("XLSX library is not loaded.");
      const dataToExport = recordsToExport.map(r => ({
        '工作屬性': r.workAttribute, '請修日期': r.requestDate, '請修時間': r.requestTime, '故障描述': r.faultDescription,
        '處理情形': r.handlingStatus, '場域': r.venue, '區域': r.area, '基礎分類': r.workTypeClassification,
        '故障標籤': r.faultTags.join(', '), '使用材料': r.materialsUsed.map(m => `${m.name} x${m.quantity}`).join(', ')
      }));
      const summaryStats = [
        { '統計項目': '篩選後維修案件數', '數值': recordsToExport.length },
      ];
      const wsData = window.XLSX.utils.json_to_sheet(dataToExport);
      const wsSummary = window.XLSX.utils.json_to_sheet(summaryStats);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, wsData, '維修紀錄');
      window.XLSX.utils.book_append_sheet(wb, wsSummary, '統計結果 (基於篩選)');
      window.XLSX.writeFile(wb, `維修紀錄分析報告_${new Date().toISOString().slice(0,10)}.xlsx`);
      showAppMessage("Excel 報告已成功匯出！", "success");
    } catch (err) {
      setError("匯出 Excel 失敗: " + err.message);
    } finally { setIsLoading(false); }
  };

  const deleteRecord = async (recordId) => {
    showConfirm("確定要刪除這條維修紀錄嗎？此動作無法復原。", () => {
      setIsLoading(true);
      try {
        setRecords(prevRecords => prevRecords.filter(record => record.id !== recordId));
        showAppMessage("紀錄已成功從列表中移除。", "success");
      } catch (err) {
        setError("移除紀錄失敗: " + err.message);
      } finally { setIsLoading(false); }
    });
  };

  const handleDeleteAllFilteredRecords = async () => {
    if (filteredRecords.length === 0) {
      showAppMessage("目前沒有可刪除的篩選後紀錄。", 'info');
      return;
    }
    const recordCount = filteredRecords.length;
    const isAnyFilterActive = searchTerm || venueFilter || areaFilter || workTypeFilter || yearFilter || monthFilter;
    const confirmationMessage = isAnyFilterActive
      ? `您確定要刪除目前篩選出的 ${recordCount} 條維修紀錄嗎？此操作無法復原。`
      : `您確定要刪除資料庫中所有的 ${recordCount} 條維修紀錄嗎？此操作無法復原，請謹慎操作！`;
    showConfirm(confirmationMessage, () => {
      setIsLoading(true);
      setError(null);
      try {
        const idsToDelete = new Set(filteredRecords.map(r => r.id));
        setRecords(prevRecords => prevRecords.filter(record => !idsToDelete.has(record.id)));
        showAppMessage(`${recordCount} 條紀錄已成功從列表中移除。`, "success");
      } catch (err) {
        console.error("批次移除紀錄失敗:", err);
        setError("移除多筆紀錄失敗: " + err.message);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const uniqueVenueValues = () => [...new Set(records.filter(r => r.isValid && r.venue).map(r => r.venue))].sort((a,b) => a.localeCompare(b, 'zh-Hant'));
  const uniqueWorkTypeValues = () => [...new Set(records.filter(r => r.isValid && r.workTypeClassification).map(r => r.workTypeClassification))].sort((a,b) => a.localeCompare(b, 'zh-Hant'));

  const handleAddFaultReason = async () => {
    const newReasonText = newFaultReason.trim();
    if (!newReasonText) return;
    if (managedFaultReasons.some(reason => reason.text.toLowerCase() === newReasonText.toLowerCase())) {
      showAppMessage("此故障原因已存在。", "warning");
      return;
    }
    const newReason = { id: uuidv4(), text: newReasonText, createdAt: new Date().toISOString() };
    setManagedFaultReasons(prev => [...prev, newReason].sort((a,b) => a.text.localeCompare(b.text, 'zh-Hant')));
    setNewFaultReason('');
    showAppMessage("故障原因已新增。", "success");
  };

  const handleDeleteFaultReason = async (id) => {
    showConfirm("確定要刪除這個故障原因嗎？", () => {
      setManagedFaultReasons(prev => prev.filter(reason => reason.id !== id));
      showAppMessage("故障原因已刪除。", "success");
    });
  };

  const handleAddMaterialName = async () => {
    const newMaterialText = newMaterialName.trim();
    if (!newMaterialText) return;
    if (managedMaterialNames.some(material => material.name.toLowerCase() === newMaterialText.toLowerCase())) {
      showAppMessage("此材料名稱已存在。", "warning");
      return;
    }
    const newMaterial = { id: uuidv4(), name: newMaterialText, createdAt: new Date().toISOString() };
    setManagedMaterialNames(prev => [...prev, newMaterial].sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')));
    setNewMaterialName('');
    showAppMessage("材料名稱已新增。", "success");
  };

  const handleDeleteMaterialName = async (id) => {
    showConfirm("確定要刪除這個材料名稱嗎？", () => {
      setManagedMaterialNames(prev => prev.filter(material => material.id !== id));
      showAppMessage("材料名稱已刪除。", "success");
    });
  };

  const addUncategorizedToManagedList = async (itemText, type) => {
    if (type === 'fault') {
      setNewFaultReason(itemText);
      showAppMessage(`"${itemText}" 已預填至新增故障原因欄位，請確認後新增。`, "info");
    } else if (type === 'material') {
      const qtyMatch = itemText.match(qtyUnitPattern);
      const baseName = qtyMatch && qtyMatch[1] ? qtyMatch[1].trim() : itemText.trim();
      setNewMaterialName(baseName);
      showAppMessage(`"${baseName}" 已預填至新增材料名稱欄位，請確認後新增。`, "info");
    }
    setActiveTab('management');
  };

  const handleExportManagedList = (list, filenamePrefix) => {
    if (list.length === 0) {
      showAppMessage("沒有資料可匯出。", "info");
      return;
    }
    const dataToExport = list.map(item => ({ name: item.name || item.text }));
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    showAppMessage("列表已匯出。", "success");
  };

  const handleImportManagedList = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!Array.isArray(jsonData)) throw new Error("檔案格式不符，應為 JSON 陣列。");
        let addedCount = 0;
        let skippedCount = 0;
        const itemsToAdd = [];
        if (type === 'fault') {
          jsonData.forEach(item => {
            const itemValue = item.text || item.name;
            if (itemValue && typeof itemValue === 'string' && itemValue.trim()) {
              const trimmedValue = itemValue.trim();
              if (!managedFaultReasons.some(existing => existing.text.toLowerCase() === trimmedValue.toLowerCase())) {
                itemsToAdd.push({ id: uuidv4(), text: trimmedValue, createdAt: new Date().toISOString() });
                addedCount++;
              } else {
                skippedCount++;
              }
            }
          });
          setManagedFaultReasons(prev => [...prev, ...itemsToAdd].sort((a,b) => a.text.localeCompare(b.text, 'zh-Hant')));
        } else if (type === 'material') {
          jsonData.forEach(item => {
            const itemValue = item.name || item.text;
            if (itemValue && typeof itemValue === 'string' && itemValue.trim()) {
              const trimmedValue = itemValue.trim();
              if (!managedMaterialNames.some(existing => existing.name.toLowerCase() === trimmedValue.toLowerCase())) {
                itemsToAdd.push({ id: uuidv4(), name: trimmedValue, createdAt: new Date().toISOString() });
                addedCount++;
              } else {
                skippedCount++;
              }
            }
          });
          setManagedMaterialNames(prev => [...prev, ...itemsToAdd].sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')));
        }
        showAppMessage(`${addedCount} 項已成功匯入並新增！ ${skippedCount} 項因重複或無效而被跳過。`, "success");
      } catch (err) {
        console.error(`匯入 ${type} 列表失敗:`, err);
        setError(`匯入失敗: ${err.message}`);
      } finally {
        setIsLoading(false);
        if (event.target) event.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const handleRefreshAndRecategorize = async () => {
    if (records.length === 0) {
      showAppMessage("沒有記錄可供重新整理和分類。", "info");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const currentFaultReasons = managedFaultReasons;
      const currentMaterialNames = managedMaterialNames;
      const reprocessedRecords = records.map(existingRecord => {
        const rawLikeRecord = {
          '工作屬性': existingRecord.workAttribute,
          '請修日期': existingRecord.requestDate,
          '請修時間': existingRecord.requestTime,
          '故障描述': existingRecord.faultDescription,
          '處理情形': existingRecord.handlingStatus,
          originalIndex: existingRecord.originalIndex || 0
        };
        const processedPart = processRecord(rawLikeRecord, existingRecord.originalIndex || 0, currentFaultReasons, currentMaterialNames);
        return { ...existingRecord, ...processedPart };
      });
      setRecords(reprocessedRecords.sort((a, b) => {
        const timeA = a.requestTime ? convertTo24Hour(a.requestTime) : "00:00";
        const timeB = b.requestTime ? convertTo24Hour(b.requestTime) : "00:00";
        const dateA = new Date(`${a.requestDate} ${timeA}`);
        const dateB = new Date(`${b.requestDate} ${timeB}`);
        return dateB - dateA;
      }));
      showAppMessage(`${reprocessedRecords.length} 條記錄已成功在本機重新整理與分類！`, "success");
    } catch (e) {
      console.error("重新整理與分類資料失敗:", e);
      setError("重新整理與分類資料失敗: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsImage = () => {
    if (!isHtml2canvasReady) {
        showAppMessage("圖片擷取功能尚未準備就緒。", "error");
        return;
    }
    const elementToCapture = document.getElementById('app-container');
    if (!elementToCapture) {
        showAppMessage("找不到可擷取的應用程式區域。", "error");
        return;
    }
    setIsLoading(true);
    showAppMessage("正在產生儀表板圖片，請稍候...", "info");

    window.html2canvas(elementToCapture, {
        useCORS: true,
        scale: 2,
        ignoreElements: (element) => element.classList.contains('screenshot-ignore')
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `科工館維修分析報告_${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setIsLoading(false);
        showAppMessage("儀表板圖片已成功儲存！", "success");
    }).catch(err => {
        console.error("儲存圖片失敗:", err);
        setError("儲存圖片失敗: " + err.message);
        setIsLoading(false);
    });
  };

  if (!isAuthReady) return <div className="p-8 text-center text-xl no-print">正在初始化用戶身份...</div>;

  return (
    <div id="app-container" className="min-h-screen bg-gray-100 p-4 font-sans">
      <header className="bg-blue-600 text-white p-6 rounded-t-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center">科工館設施維修智能分析系統</h1>
      </header>
      <nav className="bg-white p-3 shadow-md rounded-b-lg mb-6 flex justify-center space-x-2 flex-wrap">
        {['dashboard', 'data', 'upload', 'management'].map(tabName => (
          <button key={tabName} onClick={() => setActiveTab(tabName)}
            className={`px-6 py-2 my-1 rounded-md font-semibold transition-colors duration-200 ease-in-out ${activeTab === tabName ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100'}`}>
            {tabName === 'dashboard' && '儀表板'}
            {tabName === 'data' && '資料列表'}
            {tabName === 'upload' && '上傳資料'}
            {tabName === 'management' && '⚙️ 管理設定'}
          </button>
        ))}
      </nav>
      {(isLoading || isGeminiLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[101] screenshot-ignore">
          <div className="bg-white p-5 rounded-lg shadow-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-lg font-semibold text-gray-700">{isGeminiLoading ? '智能分析中...' : '處理中，請稍候...'}</p>
          </div>
        </div>
      )}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 screenshot-ignore" role="alert">
        <strong className="font-bold">錯誤!</strong> <span className="block sm:inline"> {error}</span>
        <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3"><span className="text-2xl leading-none">&times;</span></button>
      </div>}
      <CustomMessageModal show={messageConfig.show} text={messageConfig.text} type={messageConfig.type} onClose={() => setMessageConfig({ show: false, text: '', type: 'info' })} />
      <ConfirmModal show={confirmModalConfig.show} message={confirmModalConfig.message} onConfirm={confirmModalConfig.onConfirm} onCancel={confirmModalConfig.onCancel} />
      <GeminiAnalysisModal isOpen={isGeminiModalOpen} onClose={() => setIsGeminiModalOpen(false)} analysisResult={geminiAnalysisResult} isLoading={isGeminiLoading} />
      
      <div className={`${activeTab === 'upload' ? '' : 'hidden'}`}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">上傳 Excel 維修紀錄</h2>
          <p className="text-gray-600 mb-2">支援 .xlsx 或 .xls 格式。</p>
          <p className="text-gray-600 mb-4">必要欄位：工作屬性、請修日期 (YYYY/MM/DD)、請修時間 (HH:mm 12小時制)、故障描述、處理情形。</p>
          {!isXlsxReady && <p className="text-orange-600 mb-2">Excel 處理功能載入中，請稍候... 如果長時間未就緒，請檢查網路連線或重新整理頁面。</p>}
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            disabled={isLoading || !isXlsxReady}/>
        </div>
      </div>
      
      <div className={`${activeTab === 'dashboard' ? 'space-y-6' : 'hidden'}`}>
        <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-700">儀表板篩選</h3>
                <button
                    onClick={handleRefreshAndRecategorize}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md text-sm disabled:opacity-50"
                    disabled={isLoading || isGeminiLoading || records.length === 0}
                >
                    🔄 重新整理與分類資料
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="p-2 border rounded-md w-full col-span-1">
                <option value="">所有年份</option> {availableYearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="p-2 border rounded-md w-full col-span-1">
                <option value="">所有月份</option> {availableMonthOptions.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
              <select value={venueFilter} onChange={e => setVenueFilter(e.target.value)} className="p-2 border rounded-md w-full col-span-1">
                <option value="">所有場域</option> {uniqueVenueValues().map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="p-2 border rounded-md w-full col-span-1">
                <option value="">所有區域</option> {availableAreaOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={workTypeFilter} onChange={e => setWorkTypeFilter(e.target.value)} className="p-2 border rounded-md w-full col-span-1">
                <option value="">所有工作類型</option> {uniqueWorkTypeValues().map(wt => <option key={wt} value={wt}>{wt}</option>)}
              </select>
              <button onClick={() => {setYearFilter(''); setMonthFilter(''); setVenueFilter(''); setAreaFilter(''); setWorkTypeFilter(''); setSearchTerm('');}} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded w-full col-span-1">清除篩選</button>
            </div>
        </div>
        <div className="dashboard-area bg-gray-100 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DashboardCard title="場域維修分佈 (依篩選期間)">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <Pie data={venueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                            {venueData.map((entry, index) => (<Cell key={`cell-${index}`} fill={VENUE_COLORS[entry.name] || COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </DashboardCard>
                <DashboardCard title="區域維修熱點 (Top 15, 依篩選期間)">
                    <ResponsiveContainer width="100%" height={300 + (Math.min(areaHotspotData.slice(0,15).length, 15)-10)*10}>
                        <BarChart data={areaHotspotData.slice(0,15)} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={100} interval={0} tick={{fontSize: 12}} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: 10}} />
                        <Bar dataKey="value" name="維修次數">
                            {areaHotspotData.slice(0,15).map((entry, index) => {
                            let color = VENUE_COLORS['未知場域'] || COLORS[index % COLORS.length];
                            if (entry.name.startsWith('北館')) { color = VENUE_COLORS['北館']; }
                            else if (entry.name.startsWith('南館')) { color = VENUE_COLORS['南館']; }
                            return <Cell key={`cell-area-${index}`} fill={color} />;
                            })}
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </DashboardCard>
            </div>
            {topThreeAreasFaultData.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">熱點區域異常類型分析 (Top 3 區域, 依篩選期間)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {topThreeAreasFaultData.map(areaData => (
                    <DashboardCard key={areaData.areaFullName} title={`${areaData.areaFullName} (共 ${areaData.totalRepairs} 次)`}>
                    {areaData.faultTypes.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200 + areaData.faultTypes.length * 15}>
                        <BarChart data={areaData.faultTypes} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={80} interval={0} tick={{fontSize: 12}}/>
                            <Tooltip />
                            <Bar dataKey="value" name="次數" fill={areaData.barColor} >
                            <LabelList dataKey="value" position="center" style={{ fill: isColorDark(areaData.barColor) ? '#FFFFFF' : '#4A5568', fontSize: '10px', fontWeight: '500' }} />
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-gray-500">此區域無詳細故障類型資料</p>}
                    </DashboardCard>
                ))}
                </div>
            </div>
            )}
            <DashboardCard title="材料使用量 (Top 20, 依篩選期間)">
            <ResponsiveContainer width="100%" height={350 + (Math.min(materialUsageData.slice(0,20).length, 20)-10)*10}>
                <BarChart data={materialUsageData.slice(0,20)} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} interval={0} tick={{fontSize: 11}} wrapperStyle={{ whiteSpace: 'normal', wordWrap: 'break-word' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#00C49F" allowDecimals={false}/>
                <Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}/>
                <Legend />
                <Bar yAxisId="left" dataKey="數量" name="使用數量" fill="#00C49F">
                    <LabelList dataKey="數量" position="center" style={{ fill: isColorDark("#00C49F") ? '#FFFFFF' : '#4A5568', fontSize: '10px', fontWeight: '500' }} />
                </Bar>
                </BarChart>
            </ResponsiveContainer>
            </DashboardCard>
            <DashboardCard title="歷史維修頻率趨勢（依載入資料範圍）">
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={overallMaintenanceTrendByWorkType} margin={{ top: 10, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: '月份', position: 'insideBottomRight', offset: -10 }}/>
                <YAxis allowDecimals={false}/>
                <Tooltip />
                <Legend />
                {Object.keys(WORK_TYPE_COLORS).filter(type => type !== '其他').map(workType => (
                    <Line key={workType} type="monotone" dataKey={workType} stroke={WORK_TYPE_COLORS[workType]} name={workType} activeDot={{ r: 6 }} strokeWidth={2} />
                ))}
                </LineChart>
            </ResponsiveContainer>
            </DashboardCard>
            <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">智能分析與報告</h3>
                <div className="flex flex-wrap gap-4">
                    <button onClick={handleGeneratePreventiveMaintenanceSuggestions} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50" disabled={isGeminiLoading || dashboardFilteredRecords.length === 0}>✨ 獲取智能維護建議</button>
                    <button
                        onClick={handleSaveAsImage}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                        disabled={isLoading || isGeminiLoading || !isHtml2canvasReady}
                    >
                        📸 儀表板輸出
                    </button>
                </div>
                {dashboardFilteredRecords.length === 0 && activeTab === 'dashboard' && <p className="text-sm text-yellow-600 mt-2">目前篩選條件下無資料可供分析。</p>}
                <div className="mt-4">
                    <h4 className="text-lg font-semibold text-gray-700">潛在分析洞見 (模擬, 依篩選期間):</h4>
                    {dashboardFilteredRecords.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {areaHotspotData.length > 0 && <li>異常高發區域：{areaHotspotData[0].name} (共 {areaHotspotData[0].value} 次)</li>}
                        {dashboardMaintenanceTrendData.length > 0 && <li>維修高峰可能集中在：{dashboardMaintenanceTrendData.sort((a,b) => b.維修數量 - a.維修數量)[0]?.name || 'N/A'}</li>}
                        {materialUsageData.length > 0 && <li>最常用材料：{materialUsageData[0].name} (共 {materialUsageData[0].數量} 件)</li>}
                        <li>建議對高發區域及常用損耗材料進行預防性檢查與備料。</li>
                    </ul>
                    ) : (<p className="text-gray-500">尚無足夠資料生成分析洞見。</p>)}
                </div>
            </div>
        </div>
      </div>

      <div className={`${activeTab === 'data' ? '' : 'hidden'}`}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">維修紀錄列表</h2>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <input type="text" placeholder="搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md w-full col-span-full lg:col-span-2"/>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="p-2 border rounded-md w-full">
                <option value="">所有年份</option>{availableYearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="p-2 border rounded-md w-full">
                <option value="">所有月份</option>{availableMonthOptions.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <select value={venueFilter} onChange={e => setVenueFilter(e.target.value)} className="p-2 border rounded-md w-full">
                <option value="">所有場域</option>{uniqueVenueValues().map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="p-2 border rounded-md w-full">
                <option value="">所有區域</option>{availableAreaOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={workTypeFilter} onChange={e => setWorkTypeFilter(e.target.value)} className="p-2 border rounded-md w-full">
                <option value="">所有工作類型</option>{uniqueWorkTypeValues().map(wt => <option key={wt} value={wt}>{wt}</option>)}
            </select>
          </div>
          <div className="mb-4 flex justify-between items-center">
            <button
                onClick={handleDeleteAllFilteredRecords}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm disabled:opacity-50"
                disabled={isLoading || isGeminiLoading || filteredRecords.length === 0}
            >
                🗑️ 全部刪除目前篩選紀錄 ({filteredRecords.length})
            </button>
            <button onClick={exportToExcel} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50" disabled={isLoading || filteredRecords.length === 0 || !isXlsxReady}>匯出 Excel 報告</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>{['請修日期', '時間', '場域', '區域', '工作屬性', '故障描述', '處理情形', '材料', '標籤', '操作'].map(header => (<th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>))}</tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id || record.originalIndex} className={`${!record.isValid ? 'bg-red-50' : ''} hover:bg-gray-50`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.requestDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.requestTime}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.venue}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.area}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${WORK_TYPE_COLORS[record.workTypeClassification] ? '' : 'bg-gray-100 text-gray-800'}`} style={{backgroundColor: WORK_TYPE_COLORS[record.workTypeClassification] ? `${WORK_TYPE_COLORS[record.workTypeClassification]}20` : undefined, color: WORK_TYPE_COLORS[record.workTypeClassification] || undefined}}>{record.workTypeClassification}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={record.faultDescription}>{record.faultDescription}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={record.handlingStatus}>{record.handlingStatus}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{record.materialsUsed && record.materialsUsed.map(m => `${m.name}(${m.quantity})`).join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.faultTags && record.faultTags.map(tag => (<span key={tag} className="mr-1 mb-1 px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-purple-100 text-purple-800">{tag}</span>))}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium"><button onClick={() => deleteRecord(record.id)} className="text-red-600 hover:text-red-800 transition-colors">刪除</button></td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (<tr><td colSpan="10" className="text-center py-4 text-gray-500">無符合條件的紀錄。</td></tr>)}
              </tbody>
            </table>
          </div>
          {!records.every(r => r.isValid) && records.some(r => !r.isValid) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
              <h4 className="font-semibold text-yellow-700">注意：</h4>
              <p className="text-sm text-yellow-600">{records.filter(r => !r.isValid).length} 條紀錄因資料格式錯誤或欄位缺失而未顯示在主要列表或分析中。請檢查上傳檔案的以下欄位：{ [...new Set(records.filter(r => !r.isValid).flatMap(r => r.validationErrors))].join(', ') }。</p>
            </div>
          )}
        </div>
      </div>
      
      <div className={`${activeTab === 'management' ? 'space-y-8' : 'hidden'}`}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">⚙️ 管理設定</h2>
          <section className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-3">故障原因管理</h3>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newFaultReason} onChange={e => setNewFaultReason(e.target.value)} placeholder="新增故障原因" className="flex-grow p-2 border rounded-md"/>
              <button onClick={handleAddFaultReason} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md">新增</button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => handleExportManagedList(managedFaultReasons, '故障原因清單')} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md text-sm">匯出 JSON</button>
              <label className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-md text-sm cursor-pointer">匯入 JSON<input type="file" accept=".json" className="hidden" onChange={(e) => handleImportManagedList(e, 'fault')} /></label>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
              {managedFaultReasons.map(reason => (
                <li key={reason.id} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                  <span>{reason.text}</span>
                  <button onClick={() => handleDeleteFaultReason(reason.id)} className="text-red-500 hover:text-red-700 font-medium">刪除</button>
                </li>
              ))}
              {managedFaultReasons.length === 0 && <li className="text-gray-500 text-center p-2">尚未定義故障原因</li>}
            </ul>
          </section>
          <section className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-3">材料名稱管理</h3>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="新增材料名稱 (例如：LED燈泡-10W)" className="flex-grow p-2 border rounded-md"/>
              <button onClick={handleAddMaterialName} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md">新增</button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => handleExportManagedList(managedMaterialNames, '材料名稱清單')} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md text-sm">匯出 JSON</button>
              <label className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-md text-sm cursor-pointer">匯入 JSON<input type="file" accept=".json" className="hidden" onChange={(e) => handleImportManagedList(e, 'material')} /></label>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
              {managedMaterialNames.map(material => (
                <li key={material.id} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                  <span>{material.name}</span>
                  <button onClick={() => handleDeleteMaterialName(material.id)} className="text-red-500 hover:text-red-700 font-medium">刪除</button>
                </li>
              ))}
              {managedMaterialNames.length === 0 && <li className="text-gray-500 text-center p-2">尚未定義材料名稱</li>}
            </ul>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-gray-700 mb-3">待檢閱的未分類項目</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-gray-600 mb-2">未分類故障描述：</h4>
                {uncategorizedFaultDescriptions.length > 0 ? (
                  <ul className="space-y-1 max-h-48 overflow-y-auto border p-2 rounded-md bg-yellow-50">
                    {uncategorizedFaultDescriptions.map((desc, index) => (
                      <li key={`uf-${index}`} className="text-sm text-yellow-800 p-1 rounded hover:bg-yellow-100 flex justify-between items-center">
                        <span className="whitespace-normal break-words pr-2" title={desc}>{desc}</span>
                        <button onClick={() => addUncategorizedToManagedList(desc, 'fault')} className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white py-0.5 px-1.5 rounded flex-shrink-0">加入原因</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-500 text-sm">目前無未分類故障描述。</p>}
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-600 mb-2">未分類材料字串：</h4>
                {uncategorizedMaterialStrings.length > 0 ? (
                  <ul className="space-y-1 max-h-48 overflow-y-auto border p-2 rounded-md bg-yellow-50">
                    {uncategorizedMaterialStrings.map((matStr, index) => (
                      <li key={`um-${index}`} className="text-sm text-yellow-800 p-1 rounded hover:bg-yellow-100 flex justify-between items-center">
                        <span className="whitespace-normal break-words pr-2" title={matStr}>{matStr}</span>
                        <button onClick={() => addUncategorizedToManagedList(matStr, 'material')} className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white py-0.5 px-1.5 rounded flex-shrink-0">加入材料</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-500 text-sm">目前無未分類材料字串。</p>}
              </div>
            </div>
          </section>
        </div>
      </div>
      
      <footer className="text-center text-sm text-gray-500 mt-8 pb-4 screenshot-ignore">科工館設施維修智能分析系統 © {new Date().getFullYear()}</footer>
    </div>
  );
};

const DashboardCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        {children}
    </div>
);

const CustomMessageModal = ({ show, text, type, onClose }) => {
  if (!show) return null;
  let titleText = "提示"; let titleColor = "text-blue-600";
  if (type === 'error') { titleText = "錯誤"; titleColor = "text-red-600"; }
  if (type === 'success') { titleText = "成功"; titleColor = "text-green-600"; }
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-[100] screenshot-ignore">
      <div className="p-5 border w-auto max-w-md shadow-lg rounded-md bg-white mx-4">
        <div className="text-center">
          <h3 className={`text-xl leading-6 font-medium ${titleColor} mb-2`}>{titleText}</h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-md text-gray-700 whitespace-pre-line">{text}</p>
          </div>
          <div className="items-center px-4 py-3">
            <button onClick={onClose} className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
};
const ConfirmModal = ({ show, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-[100] screenshot-ignore">
      <div className="p-5 border w-auto max-w-md shadow-lg rounded-md bg-white mx-4">
        <div className="text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{message}</h3>
          <div className="flex justify-around mt-4 space-x-3">
            <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 w-1/2">確定</button>
            <button onClick={onCancel} className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 w-1/2">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
};
const GeminiAnalysisModal = ({ isOpen, onClose, analysisResult, isLoading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-[100] screenshot-ignore">
      <div className="p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl leading-6 font-medium text-indigo-700">✨ 智能分析結果</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="mt-2 px-2 py-3 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-3"></div>
              <p className="text-indigo-600">分析生成中，請稍候...</p>
            </div>
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-md">{analysisResult || "未能獲取分析結果。"}</pre>
          )}
        </div>
        <div className="items-center px-4 py-3 mt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">關閉</button>
        </div>
      </div>
    </div>
  );
};

export default App;
