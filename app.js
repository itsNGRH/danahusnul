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
                nominal: Number(r.Nominal) || 0
            }));

        renderBeranda();
        renderTransaksi();
    }
});

// =======================
// Render Beranda
// =======================
function renderBeranda(filterType = null, start = null, end = null) {
    let totalMasuk = 0, totalKeluar = 0;
    const monthlyMap = {}, yearlyMap = {};

    dataTransaksi.forEach(d => {
        const year = d.tanggal.getFullYear();
        const month = d.tanggal.getMonth() + 1;
        const keyMonth = `${year}-${month}`;
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
    if (filterType === 'bulan') {
        Object.keys(monthlyMap).sort().forEach(k => {
            const [y,m] = k.split('-');
            labels.push(
                new Date(y, m - 1).toLocaleDateString('id-ID', {
                    month: 'short',
                    year: 'numeric'
                })
            );
            dataMasuk.push(monthlyMap[k].masuk);
            dataKeluar.push(monthlyMap[k].keluar);
        });
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
                const key = `${current.getFullYear()}-${current.getMonth()+1}`;
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
            options:{
                responsive:true,
                plugins:{legend:{position:'top'}},
                scales:{ y:{ticks:{callback: v=>'Rp '+v.toLocaleString('id-ID')}}}
            }
        });
    }
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
                <td>${formatTanggal(d.tanggal)}</td>
                <td>${formatJenis(d.jenis)}</td>
                <td class="kolom-keterangan">${d.keterangan}</td>
                <td class="kolom-nominal ${d.jenis}">
                    Rp ${d.nominal.toLocaleString('id-ID')}
                </td>
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
    document.getElementById('catatan-periode').innerText = periodeText;
    document.getElementById('catatan-total-masuk').innerText = formatRupiah(totalMasuk);
    document.getElementById('catatan-total-keluar').innerText = formatRupiah(totalKeluar);
    document.getElementById('catatan-saldo').innerText = formatRupiah(saldo);
    document.getElementById('tfoot-saldo').innerText = formatRupiah(saldo);

    // Tabel
    const tbody = document.getElementById('catatan-tbody');
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
   EVENT: TAMPILKAN CATATAN
========================= */
document.getElementById('btn-tampil-catatan').addEventListener('click', () => {
    const periode = document.getElementById('periode-catatan').value;
    if (!periode) {
        alert('Pilih periode');
        return;
    }
    tampilkanCatatan(periode);
});

/* =========================
   PDF CATATAN
========================= */
document.getElementById('btn-pdf-catatan').addEventListener('click', () => {
    const periode = document.getElementById('periode-catatan').value;
    if (!periode) {
        alert('Pilih periode terlebih dahulu');
        return;
    }

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
    const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2; // 180mm

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
       RINGKASAN
    ========================= */
    doc.setFontSize(10);
    doc.text('Ringkasan:', PAGE_MARGIN, 42);

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
            ['Saldo', formatRupiah(saldo)]
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
            1: { halign: 'center', cellWidth: CONTENT_WIDTH * 0.18 },
            2: { halign: 'center', cellWidth: CONTENT_WIDTH * 0.18 },
            3: { halign: 'left',   cellWidth: CONTENT_WIDTH * 0.37 },
            4: { halign: 'right',  cellWidth: CONTENT_WIDTH * 0.20 }
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
            0: { cellWidth: CONTENT_WIDTH * 0.8 },
            1: { halign: 'right', cellWidth: CONTENT_WIDTH * 0.2 }
        }
    });

    /* =========================
       SIMPAN
    ========================= */
    const [year, month] = periode.split('-');

    const namaBulan = new Date(year, month - 1).toLocaleDateString('id-ID', {
        month: 'long'
    });

    doc.save(`Catatan Keuangan Masjid Husnul Khatimah ${namaBulan} ${year}.pdf`);

});

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
   LAPORAN TAHUNAN (UTIL)
========================= */
function getLaporanTahunan(year) {
    const laporan = {};

    dataTransaksi
        .filter(d => d.tanggal.getFullYear() === year)
        .forEach(d => {
            const bulan = d.tanggal.getMonth() + 1;
            laporan[bulan] ??= { masuk: 0, keluar: 0 };

            if (d.jenis === 'pemasukan') laporan[bulan].masuk += d.nominal;
            if (d.jenis === 'pengeluaran') laporan[bulan].keluar += d.nominal;
        });

    return Object.keys(laporan).map(bulan => ({
        bulan: new Date(year, bulan - 1)
            .toLocaleDateString('id-ID', { month: 'long' }),
        masuk: laporan[bulan].masuk,
        keluar: laporan[bulan].keluar,
        saldo: laporan[bulan].masuk - laporan[bulan].keluar
    }));
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
