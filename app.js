const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQEhyMGpYCVeno5svdrk17KgF0Jd6YfRzrdcygTD6xqf-XAkSyNjqaZxlsmyFyeJ-DigjOhkovcMrKM/pub?gid=1009452389&single=true&output=csv";

let dataTransaksi = [];
let chartBeranda = null;

// =======================
// Load CSV
// =======================
function parseTanggal(str) {
    if (!str) return null;

    const [day, mon, year] = str.split(' ');
    const bulanMap = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3,
        Mei: 4, Jun: 5, Jul: 6, Agu: 7,
        Sep: 8, Okt: 9, Nov: 10, Des: 11
    };

    return new Date(year, bulanMap[mon], Number(day));
}

Papa.parse(CSV_URL, {
    download: true,
    header: true,
    complete: results => {
        dataTransaksi = results.data
            .filter(r => r.Tanggal)
            .map(r => ({
                tanggal: parseTanggal(r.Tanggal),
                jenis: (r.Jenis || '').toLowerCase(),
                keterangan: r.Keterangan || '-',
                nominal: parseNominal(r.Nominal)
            }));

        renderBeranda();
        renderTransaksi();
    }
});

function parseNominal(value) {
    if (!value) return 0;

    return Number(
        value
            .toString()
            .replace(/\./g, '')
            .replace(/,/g, '.')
    ) || 0;
}

// =======================
// Render Beranda
// =======================
function renderBeranda(filterType = null, start = null, end = null) {
    let totalMasuk = 0, totalKeluar = 0;
    const monthlyMap = {}, yearlyMap = {};

    dataTransaksi.forEach(d => {
        const year = d.tanggal.getFullYear();
        const month = d.tanggal.getMonth() + 1;
        const keyMonth = `${year}-${String(month).padStart(2, '0')}`;
        const keyYear = `${year}`;

        // Filter
        if (filterType === 'bulan' && start && end) {
            const startDate = new Date(start + '-01');
            const [yEnd, mEnd] = end.split('-');
            const endDate = new Date(Number(yEnd), Number(mEnd), 0);
            if (d.tanggal < startDate || d.tanggal > endDate) return;
        }
        if (filterType === 'tahun' && start && end) {
            const yStart = Number(start), yEnd = Number(end);
            if (year < yStart || year > yEnd) return;
        }

        // Total
        if (d.jenis === 'pemasukan') totalMasuk += d.nominal;
        if (d.jenis === 'pengeluaran') totalKeluar += d.nominal;

        // Map bulanan
        monthlyMap[keyMonth] ??= {masuk:0, keluar:0};
        yearlyMap[keyYear] ??= {masuk:0, keluar:0};

        if (d.jenis === 'pemasukan') {
            monthlyMap[keyMonth].masuk += d.nominal;
            yearlyMap[keyYear].masuk += d.nominal;
        }
        if (d.jenis === 'pengeluaran') {
            monthlyMap[keyMonth].keluar += d.nominal;
            yearlyMap[keyYear].keluar += d.nominal;
        }
    });

    const saldo = totalMasuk - totalKeluar;
    document.getElementById('saldo').innerText = `Rp ${saldo.toLocaleString('id-ID')}`;
    document.getElementById('total-masuk').innerText = `Rp ${totalMasuk.toLocaleString('id-ID')}`;
    document.getElementById('total-keluar').innerText = `Rp ${totalKeluar.toLocaleString('id-ID')}`;

    // Chart data
    let labels = [], dataMasuk = [], dataKeluar = [];
    if (filterType === 'bulan' && start && end) {
        let current = new Date(start + '-01');
        const [yEnd, mEnd] = end.split('-');
        const endDate = new Date(Number(yEnd), Number(mEnd), 1);

        while (current <= endDate) {
            const key = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}`;

            labels.push(
                current.toLocaleDateString('id-ID', {
                    month: 'short',
                    year: 'numeric'
                })
            );

            if (monthlyMap[key]) {
                dataMasuk.push(monthlyMap[key].masuk);
                dataKeluar.push(monthlyMap[key].keluar);
            } else {
                dataMasuk.push(0);
                dataKeluar.push(0);
            }

            current.setMonth(current.getMonth() + 1);
        }
    } else if (filterType === 'tahun') {
        Object.keys(yearlyMap).sort().forEach(k => {
            labels.push(k);
            dataMasuk.push(yearlyMap[k].masuk);
            dataKeluar.push(yearlyMap[k].keluar);
        });
    } else { // Semua bulan
        const dates = dataTransaksi.map(d => d.tanggal).filter(Boolean);
        if (dates.length) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            while(current <= end) {
                const key = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}`;
                labels.push(`${current.getMonth()+1}/${current.getFullYear()}`);
                if(monthlyMap[key]){
                    dataMasuk.push(monthlyMap[key].masuk);
                    dataKeluar.push(monthlyMap[key].keluar);
                } else {
                    dataMasuk.push(0);
                    dataKeluar.push(0);
                }
                current.setMonth(current.getMonth()+1);
            }
        }
    }

    // Render Chart
    if(chartBeranda){
        chartBeranda.data.labels = labels;
        chartBeranda.data.datasets[0].data = dataMasuk;
        chartBeranda.data.datasets[1].data = dataKeluar;
        chartBeranda.update();
    } else {
        chartBeranda = new Chart(document.getElementById('grafik-keuangan'),{
            type:'bar',
            data:{
                labels,
                datasets:[
                    {label:'Pemasukan', data:dataMasuk, backgroundColor:'#16a34a'},
                    {label:'Pengeluaran', data:dataKeluar, backgroundColor:'#dc2626'}
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: v => 'Rp ' + v.toLocaleString('id-ID')
                        }
                    }
                }
            }
        });
    }
    setGrafikAutoWidth(labels.length);
}

window.addEventListener('resize', () => {
    if (chartBeranda) {
        setGrafikAutoWidth(chartBeranda.data.labels.length);
        chartBeranda.resize();
    }
});

function setGrafikAutoWidth(jumlahLabel) {
    const container = document.getElementById('grafik-container');
    if (!container) return;

    const isMobile = window.innerWidth <= 768;

    // Reset default (desktop)
    if (!isMobile) {
        container.style.minWidth = '100%';
        return;
    }

    /* =========================
       Konfigurasi Lebar
    ========================= */
    const WIDTH_PER_LABEL = 90;   // px per bulan (ideal)
    const MIN_WIDTH = 600;        // batas minimum
    const MAX_WIDTH = 1600;       // batas maksimum (aman)

    let calculatedWidth = jumlahLabel * WIDTH_PER_LABEL;

    calculatedWidth = Math.max(MIN_WIDTH, calculatedWidth);
    calculatedWidth = Math.min(MAX_WIDTH, calculatedWidth);

    container.style.minWidth = calculatedWidth + 'px';
}

// =======================
// Event Filter Grafik
// =======================
function handleFilterGrafik() {
    const tipe = document.getElementById('filter-tipe').value;

    if (tipe === 'bulan') {
        const start = document.getElementById('filter-bulan-start').value;
        const end = document.getElementById('filter-bulan-end').value;

        if (!start || !end) {
            alert('Pilih bulan mulai dan akhir');
            return;
        }

        renderBeranda('bulan', start, end);
    }

    if (tipe === 'tahun') {
        const start = document.getElementById('filter-tahun-start').value;
        const end = document.getElementById('filter-tahun-end').value;

        if (!start || !end) {
            alert('Pilih tahun mulai dan akhir');
            return;
        }

        renderBeranda('tahun', start, end);
    }
}

document.getElementById('btn-filter-grafik')
    .addEventListener('click', handleFilterGrafik);

document.getElementById('btn-filter-grafik-tahun')
    .addEventListener('click', handleFilterGrafik);

document.getElementById('filter-tipe').addEventListener('change', e => {
    const tipe = e.target.value;

    document.getElementById('filter-bulan-container').style.display =
        tipe === 'bulan' ? 'inline-block' : 'none';

    document.getElementById('filter-tahun-container').style.display =
        tipe === 'tahun' ? 'inline-block' : 'none';

    renderBeranda();
});

// =======================
// Render Transaksi
// =======================
const formatTanggal = date =>
    date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

function renderTransaksi(filterMonth=null){
    const tbody = document.getElementById('tabel-transaksi');
    tbody.innerHTML = '';
    let filtered = [...dataTransaksi];

    if(filterMonth){
        const [y,m] = filterMonth.split('-');
        filtered = dataTransaksi.filter(d => d.tanggal.getFullYear()==y && (d.tanggal.getMonth()+1)==m);
    }

    filtered
        .sort((a,b)=>a.tanggal - b.tanggal)
        .forEach(d=>{
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;">${formatTanggal(d.tanggal)}</td>
                <td style="text-align:center;">${formatJenis(d.jenis)}</td>
                <td class="kolom-keterangan">${d.keterangan}</td>
                <td class="kolom-nominal ${d.jenis}">Rp ${d.nominal.toLocaleString('id-ID')}</td>
            `;
            tbody.appendChild(tr);
        });
}

document.getElementById('btn-filter-transaksi').addEventListener('click', ()=>{
    const periode = document.getElementById('filter-transaksi').value;
    if(!periode) return alert("Pilih bulan dan tahun");
    renderTransaksi(periode);
});

document.getElementById('btn-reset-transaksi').addEventListener('click', ()=>{
    document.getElementById('filter-transaksi').value = '';
    renderTransaksi();
});

/* =========================
   Helpers
========================= */
const formatRupiah = value => `Rp ${value.toLocaleString('id-ID')}`;

/* =========================
   CATATAN (PDF-READY)
========================= */
function tampilkanCatatan(periode) {
    const {
        periodeText,
        totalMasuk,
        totalKeluar,
        saldo,
        rows
    } = getCatatanData(periode);

    // Ringkasan
    document.getElementById('catatan-periode-bulan').innerText = periodeText;
    document.getElementById('bulan-total-masuk').innerText = formatRupiah(totalMasuk);
    document.getElementById('bulan-total-keluar').innerText = formatRupiah(totalKeluar);
    document.getElementById('bulan-saldo').innerText = formatRupiah(saldo);
    document.getElementById('bulan-tfoot-saldo').innerText = formatRupiah(saldo);

    // Tabel
    const tbody = document.getElementById('catatan-bulan-tbody');
    tbody.innerHTML = '';

    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">${row.no}</td>
            <td style="text-align:center;">${row.tanggal}</td>
            <td style="text-align:center;">${formatJenis(row.jenis)}</td>
            <td>${row.keterangan}</td>
            <td>${formatRupiah(row.nominal)}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* =========================
   TAMPILKAN CATATAN TAHUNAN
========================= */
function tampilkanCatatanTahunan(tahun) {
    const {
        periodeText,
        totalMasuk,
        totalKeluar,
        saldoAkhir,
        rows
    } = getCatatanTahunanData(tahun);

    /* =========================
       RINGKASAN
    ========================= */
    document.getElementById('catatan-periode-tahun').innerText = periodeText;
    document.getElementById('tahun-total-masuk').innerText = formatRupiah(totalMasuk);
    document.getElementById('tahun-total-keluar').innerText = formatRupiah(totalKeluar);
    document.getElementById('tahun-saldo').innerText = formatRupiah(saldoAkhir);
    document.getElementById('tahun-tfoot-saldo').innerText = formatRupiah(saldoAkhir);

    /* =========================
       TABEL REKAP BULANAN
    ========================= */
    const tbody = document.getElementById('catatan-tahun-tbody');
    tbody.innerHTML = '';

    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">${r.no}</td>
            <td>${r.bulanText}</td>
            <td>${formatRupiah(r.pemasukan)}</td>
            <td>${formatRupiah(r.pengeluaran)}</td>
            <td>${formatRupiah(r.saldo)}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* =========================
   DATA CATATAN BULANAN
========================= */
function getCatatanData(periode) {
    const [year, month] = periode.split('-').map(Number);

    const data = dataTransaksi
        .filter(d =>
            d.tanggal.getFullYear() === year &&
            d.tanggal.getMonth() + 1 === month
        )
        .sort((a, b) => a.tanggal - b.tanggal);

    const totalMasuk = data
        .filter(d => d.jenis === 'pemasukan')
        .reduce((sum, d) => sum + d.nominal, 0);

    const totalKeluar = data
        .filter(d => d.jenis === 'pengeluaran')
        .reduce((sum, d) => sum + d.nominal, 0);

    return {
        periodeText: `Periode: ${new Date(year, month - 1)
            .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        totalMasuk,
        totalKeluar,
        saldo: totalMasuk - totalKeluar,
        rows: data.map((d, index) => ({
            no: index + 1,
            tanggal: formatTanggal(d.tanggal),
            jenis: d.jenis,
            keterangan: d.keterangan,
            nominal: d.nominal
        }))
    };
}

/* =========================
   DATA CATATAN TAHUNAN
========================= */
function getCatatanTahunanData(tahun) {
    tahun = Number(tahun);

    // Siapkan map 12 bulan
    const bulanMap = {};
    for (let i = 0; i < 12; i++) {
        bulanMap[i] = {
            pemasukan: 0,
            pengeluaran: 0
        };
    }

    // Filter transaksi tahun terkait
    const transaksiTahun = dataTransaksi.filter(d =>
        d.tanggal &&
        d.tanggal.getFullYear() === tahun
    );

    // Akumulasi per bulan
    transaksiTahun.forEach(d => {
        const bulan = d.tanggal.getMonth(); // 0 - 11

        if (d.jenis === 'pemasukan') {
            bulanMap[bulan].pemasukan += d.nominal;
        }

        if (d.jenis === 'pengeluaran') {
            bulanMap[bulan].pengeluaran += d.nominal;
        }
    });

    // Bentuk rows rekap bulanan
    const rows = [];
    let totalMasuk = 0;
    let totalKeluar = 0;

    Object.keys(bulanMap).forEach((bulan, index) => {
        const masuk = bulanMap[bulan].pemasukan;
        const keluar = bulanMap[bulan].pengeluaran;
        const saldo = masuk - keluar;

        totalMasuk += masuk;
        totalKeluar += keluar;

        rows.push({
            no: index + 1,
            bulanIndex: Number(bulan),
            bulanText: new Date(tahun, bulan)
                .toLocaleDateString('id-ID', { month: 'long' }),
            pemasukan: masuk,
            pengeluaran: keluar,
            saldo
        });
    });

    return {
        tahun,
        periodeText: `Tahun ${tahun}`,
        totalMasuk,
        totalKeluar,
        saldoAkhir: totalMasuk - totalKeluar,
        rows
    };
}

/* =========================
   TOGGLE MODE CATATAN
========================= */
const radioModes = document.querySelectorAll('input[name="catatan-mode"]');
const inputBulan = document.getElementById('periode-catatan-bulan');
const inputTahun = document.getElementById('periode-catatan-tahun');

const catatanBulanan = document.getElementById('catatan-bulanan');
const catatanTahunan = document.getElementById('catatan-tahunan');

function setModeCatatan(mode) {
    catatanBulanan.style.display = 'none';
    catatanTahunan.style.display = 'none';

    if (mode === 'bulan') {
        inputBulan.style.display = 'inline-block';
        inputTahun.style.display = 'none';
        catatanBulanan.style.display = 'block';
    }

    if (mode === 'tahun') {
        inputBulan.style.display = 'none';
        inputTahun.style.display = 'inline-block';
        catatanTahunan.style.display = 'block';
    }
}

radioModes.forEach(radio => {
    radio.addEventListener('change', e => {
        setModeCatatan(e.target.value);
    });
});

/* =========================
   INIT DEFAULT MODE
========================= */
setModeCatatan(
    document.querySelector('input[name="catatan-mode"]:checked').value
);

document.getElementById('btn-tampil-catatan').addEventListener('click', () => {
    const mode = document.querySelector('input[name="catatan-mode"]:checked').value;

    if (mode === 'bulan') {
        const periode = inputBulan.value;
        if (!periode) {
            alert('Pilih bulan dan tahun');
            return;
        }
        tampilkanCatatan(periode);
    }

    if (mode === 'tahun') {
        const tahun = inputTahun.value;
        if (!tahun) {
            alert('Pilih tahun');
            return;
        }
        tampilkanCatatanTahunan(tahun);
    }
});

document.getElementById('btn-pdf-catatan').addEventListener('click', () => {
    const mode = document.querySelector('input[name="catatan-mode"]:checked').value;

    if (mode === 'bulan') {
        const periode = inputBulan.value;
        if (!periode) {
            alert('Pilih periode bulanan');
            return;
        }
        generatePdfBulanan(periode);
    }

    if (mode === 'tahun') {
        const tahun = inputTahun.value;
        if (!tahun) {
            alert('Pilih tahun');
            return;
        }
        generatePdfTahunan(tahun);
    }
});

function generatePdfBulanan(periode) {
    const {
        periodeText,
        totalMasuk,
        totalKeluar,
        saldo,
        rows
    } = getCatatanData(periode);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const PAGE_MARGIN = 15;
    const PAGE_WIDTH = 210;
    const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

    /* =========================
       HEADER
    ========================= */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Catatan Keuangan', 105, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.text('Masjid Husnul Khatimah', 105, 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text(periodeText, 105, 29, { align: 'center' });

    doc.line(PAGE_MARGIN, 33, PAGE_WIDTH - PAGE_MARGIN, 33);

    /* =========================
       RINGKASAN BULANAN
    ========================= */
    doc.setFontSize(10);
    doc.text('Ringkasan Bulanan:', PAGE_MARGIN, 42);

    doc.autoTable({
        startY: 45,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        headStyles: {
            fillColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: CONTENT_WIDTH * 0.6 },
            1: { cellWidth: CONTENT_WIDTH * 0.4 }
        },
        body: [
            ['Total Pemasukan', formatRupiah(totalMasuk)],
            ['Total Pengeluaran', formatRupiah(totalKeluar)],
            ['Saldo Periode', formatRupiah(saldo)]
        ]
    });

    /* =========================
       TABEL TRANSAKSI
    ========================= */
    doc.text('Rincian Transaksi:', PAGE_MARGIN, doc.lastAutoTable.finalY + 10);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 13,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        head: [[
            'No',
            'Tanggal',
            'Jenis',
            'Keterangan',
            'Nominal'
        ]],
        body: rows.map(r => ([
            r.no,
            r.tanggal,
            formatJenis(r.jenis),
            r.keterangan,
            formatRupiah(r.nominal)
        ])),
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        headStyles: {
            fillColor: [200, 200, 200],
            textColor: 0,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: CONTENT_WIDTH * 0.07 },
            1: { cellWidth: CONTENT_WIDTH * 0.18 },
            2: { halign: 'center', cellWidth: CONTENT_WIDTH * 0.18 },
            3: { cellWidth: CONTENT_WIDTH * 0.37 },
            4: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.20 }
        }
    });

    /* =========================
       FOOTER SALDO
    ========================= */
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        body: [
            ['Saldo Periode', formatRupiah(saldo)]
        ],
        columnStyles: {
            0: { cellWidth: CONTENT_WIDTH * 0.75 },
            1: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.25 }
        }
    });

    /* =========================
       SIMPAN FILE
    ========================= */
    const [year, month] = periode.split('-');
    const namaBulan = new Date(year, month - 1)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    doc.save(`Catatan Keuangan Masjid Husnul Khatimah ${namaBulan}.pdf`);
}

/* =========================
   PDF CATATAN TAHUNAN
========================= */
function generatePdfTahunan(tahun) {
    const {
        periodeText,
        totalMasuk,
        totalKeluar,
        saldoAkhir,
        rows
    } = getCatatanTahunanData(tahun);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const PAGE_MARGIN = 15;
    const PAGE_WIDTH = 210;
    const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

    /* =========================
       HEADER
    ========================= */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Catatan Keuangan', 105, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.text('Masjid Husnul Khatimah', 105, 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text(periodeText, 105, 29, { align: 'center' });

    doc.setDrawColor(0);
    doc.line(PAGE_MARGIN, 33, PAGE_WIDTH - PAGE_MARGIN, 33);

    /* =========================
       RINGKASAN TAHUNAN
    ========================= */
    doc.setFontSize(10);
    doc.text('Ringkasan Tahunan:', PAGE_MARGIN, 42);

    doc.autoTable({
        startY: 45,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        headStyles: {
            fillColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: CONTENT_WIDTH * 0.6 },
            1: { cellWidth: CONTENT_WIDTH * 0.4 }
        },
        body: [
            ['Total Pemasukan', formatRupiah(totalMasuk)],
            ['Total Pengeluaran', formatRupiah(totalKeluar)],
            ['Saldo Periode', formatRupiah(saldoAkhir)]
        ]
    });

    /* =========================
       REKAP PER BULAN
    ========================= */
    doc.text('Rekap Per Bulan:', PAGE_MARGIN, doc.lastAutoTable.finalY + 10);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 13,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        head: [[
            'No',
            'Bulan',
            'Pemasukan',
            'Pengeluaran',
            'Saldo Bulanan'
        ]],
        body: rows.map(r => ([
            r.no,
            r.bulanText,
            formatRupiah(r.pemasukan),
            formatRupiah(r.pengeluaran),
            formatRupiah(r.saldo)
        ])),
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        headStyles: {
            fillColor: [200, 200, 200],
            textColor: 0,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: CONTENT_WIDTH * 0.08 },
            1: { cellWidth: CONTENT_WIDTH * 0.22 },
            2: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.23 },
            3: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.23 },
            4: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.24 }
        }
    });

    /* =========================
       FOOTER SALDO
    ========================= */
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: PAGE_MARGIN },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 0,
            lineColor: 0
        },
        body: [
            ['Saldo Periode', formatRupiah(saldoAkhir)]
        ],
        columnStyles: {
            0: { cellWidth: CONTENT_WIDTH * 0.75 },
            1: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.25 }
        }
    });

    /* =========================
       SIMPAN FILE
    ========================= */
    doc.save(`Catatan Keuangan Masjid Husnul Khatimah Tahun ${tahun}.pdf`);
}

// =======================
// Format Jenis
// =======================
const formatJenis = jenis =>
    jenis === 'pemasukan' ? 'Pemasukan' :
    jenis === 'pengeluaran' ? 'Pengeluaran' :
    jenis;

// =======================
// Navigasi Section
// =======================
document.querySelectorAll('header nav button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
        document.querySelectorAll('.section').forEach(s=>s.style.display='none');
        document.getElementById(btn.dataset.section).style.display='block';
        document.querySelectorAll('header nav button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
    });
});
document.getElementById('beranda').style.display='block';
