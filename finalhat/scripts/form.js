const queries = new URLSearchParams(window.location.search);
        const viewContainer = document.getElementById('form-payload-dump');
        let outputString = '<ul class="payload-list">';
        queries.forEach((val, key) => {
            outputString += `<li><strong>${encodeURIComponent(key)}:</strong> ${encodeURIComponent(val)}</li>`;
        });
        outputString += '</ul>';
        viewContainer.innerHTML = outputString;