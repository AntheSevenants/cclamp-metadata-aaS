document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const resultDiv = document.getElementById('result');

    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        const externalUrl = "./C-CLAMP_metadata.txt";
        const tuurUrl = "./author_metadata_hisclass_final.txt";

        try {
            if (!file || !externalUrl) {
                throw new Error('Please provide all inputs.');
            }

            // Read local file
            const localData = await readLocalFile(file);
            // Fetch external file
            let externalData = await fetchExternalFile(externalUrl, 9);
            const tuurData = await fetchExternalFile(tuurUrl, 21);

            // Keep only three columns in the external data to avoid duplicate columns
            const columnsToKeep = ["File", "Year", "Link"];
            externalData = externalData.map(item => {
                let newItem = {};
                columnsToKeep.forEach(column => {
                    newItem[column] = item[column];
                });
                return newItem;
            });

            if (!localData.columns.includes("File")) {
                throw new Error("No 'File' column in uploaded KWIC results")
            }

            // Change localData column "File" so .txt is removed!
            // Also remove superfluous whitespace
            localData.forEach(d => {
                d.File = d.File.slice(0, -4);
                d.Hit = d.Hit.trim();
            });

            // Perform left join using D3
            let joinedData = d3LeftJoin(localData, externalData, "File");
            joinedData = d3LeftJoin(joinedData, tuurData, "Link");

            downloadAsTSV(joinedData);

            resultDiv.textContent = `Metadata succesvol toegevoegd! Je nieuwe dataset werd gedownload.`;
            resultDiv.classList.add("text-success");
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.classList.add("text-danger");
        }
    };

    function readLocalFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const data = d3.tsvParse(text);

                if (data.columns.length != 4) {
                    reject(new Error(`Invalid number of columns in internal KWIC file (${data.columns.length}, should be 4)`));
                }

                resolve(data);
            };
            reader.onerror = (e) => reject(new Error('Failed to read local file.'));
            reader.readAsText(file);
        });
    }

    async function fetchExternalFile(url, columnCount) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch external file: ${response.statusText}`);
            }
            const text = await response.text();
            const data = d3.tsvParse(text);

            if (data.columns.length != columnCount) {
                new Error(`Invalid number of columns in external metadata file (${data.columns.length}, should be 9)`);
            }

            return data;
        } catch (error) {
            throw new Error(`Failed to fetch external file: ${error.message}`);
        }
    }

    function d3LeftJoin(localData, externalData, on) {
        let lookup = d3.group(externalData, d => d[on]); // this returns a Map

        let joined = localData.map(d1 => {
            let match = lookup.get(d1[on]);
            return match ? { ...d1, ...match[0] } : d1;
        });

        return joined;
    }

    function downloadAsTSV(data, filename = 'merged_dataset.txt') {
        const tsv = d3.tsvFormat(data);
        const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
});
