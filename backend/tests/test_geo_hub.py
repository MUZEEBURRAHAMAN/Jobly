from backend.app.matching import detect_geo_hub


def test_whole_words_only():
    assert detect_geo_hub("Lafayette, Indiana", None) != "india"
    assert detect_geo_hub("Toronto, Canada", None) != "us"          # "ca" inside "Canada"
    assert detect_geo_hub("Bengaluru, Karnataka", None) == "india"
    assert detect_geo_hub("New Delhi", None) == "india"
    assert detect_geo_hub("San Francisco, CA", None) == "us"
    assert detect_geo_hub("Remote - US", None) == "us"
    assert detect_geo_hub("London, UK", None) == "europe"
    assert detect_geo_hub("Kyiv, Ukraine", None) == "global"
    assert detect_geo_hub("Singapore", None) == "apac"
    assert detect_geo_hub(None, None) == "global"
