import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class MGSamples {

    // Configuration constants
    private static final String MAILGUN_API_URL = "https://api.mailgun.net/v3/sandbox2fc7beba60c84934a6b86700893dfb01.mailgun.org/messages";
    // NOTE: NEVER hardcode secrets in production code. Use environment variables.
    private static final String DEFAULT_API_KEY = "key-your-api-key-here"; 

    public static void main(String[] args) {
        try {
            System.out.println("Sending email via Mailgun (Java 11 Standard Library)...");
            
            // 1. Get API Key from Environment Variable
            String apiKey = System.getenv("MAILGUN_API_KEY");
            if (apiKey == null || apiKey.isEmpty()) {
                 // Fallback for local testing (User must replace this manually if not using env var)
                apiKey = DEFAULT_API_KEY;
                System.out.println("Warning: Using default placeholder API key. Set MAILGUN_API_KEY env var or update the code.");
            }

            // 2. Create Basic Auth Header
            String auth = "api:" + apiKey;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));

            // 3. Prepare Form Data
            Map<String, String> formData = new HashMap<>();
            formData.put("from", "Mailgun Sandbox <postmaster@sandbox2fc7beba60c84934a6b86700893dfb01.mailgun.org>");
            formData.put("to", "Big'Um Mayne <00broskis@gmail.com>");
            formData.put("subject", "Hello Big'Um Mayne");
            formData.put("text", "Congratulations Big'Um Mayne, you just sent an email with Mailgun! You are truly awesome!");

            // 4. Build Request
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(MAILGUN_API_URL))
                    .header("Authorization", "Basic " + encodedAuth)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(ofFormData(formData))
                    .build();

            // 5. Send Request
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // 6. Output Result
            System.out.println("Status Code: " + response.statusCode());
            System.out.println("Response Body: " + response.body());

            if (response.statusCode() == 200) {
                System.out.println("Email sent successfully!");
            } else {
                System.err.println("Failed to send email.");
            }

        } catch (Exception e) {
            System.err.println("Error sending email: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Helper to convert Map to URL-encoded string
    private static HttpRequest.BodyPublisher ofFormData(Map<String, String> data) {
        String form = data.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
        return HttpRequest.BodyPublishers.ofString(form);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
